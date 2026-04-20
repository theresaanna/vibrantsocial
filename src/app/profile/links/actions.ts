"use server";

import { prisma } from "@/lib/prisma";
import { requireAuthWithRateLimit, isActionError } from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";
import { invalidate, cacheKeys } from "@/lib/cache";

const MAX_LINKS = 50;
const MAX_BIO_LENGTH = 300;
const MAX_TITLE_LENGTH = 100;
const MAX_URL_LENGTH = 2048;

export interface LinksPagePatch {
  // Present → update; absent → leave existing value alone. Matches the
  // partial-patch philosophy of `updateMobileProfile` so the mobile
  // client doesn't need to include (and risk clobbering) fields it
  // doesn't surface.
  enabled?: boolean;
  bio?: string | null;
  // NOTE: `sensitiveLinks` intentionally omitted here — the mobile
  // edit screen doesn't surface the in-app-browser-hiding toggle, and
  // this action only writes keys explicitly present on the patch, so
  // the web-managed value is preserved.
  sensitiveLinks?: boolean;
  links?: { title: string; url: string }[];
}

export interface LinksPageReadShape {
  enabled: boolean;
  bio: string | null;
  sensitiveLinks: boolean;
  links: { id: string; title: string; url: string; order: number }[];
}

/**
 * Shared read helper used by the mobile route — returns the same
 * shape the JSON PUT accepts.
 */
export async function getMyLinksPage(): Promise<LinksPageReadShape | null> {
  const authResult = await requireAuthWithRateLimit("links-page");
  if (isActionError(authResult)) return null;
  const session = authResult;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      linksPageEnabled: true,
      linksPageBio: true,
      linksPageSensitiveLinks: true,
      linksPageLinks: {
        select: { id: true, title: true, url: true, order: true },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!user) return null;

  return {
    enabled: user.linksPageEnabled,
    bio: user.linksPageBio,
    sensitiveLinks: user.linksPageSensitiveLinks,
    links: user.linksPageLinks,
  };
}

/**
 * JSON-patch variant of `updateLinksPage` for the mobile client. Only
 * writes the fields the client actually sent. Shares the same
 * validation (URL scheme, max links, max bio length, max title length)
 * and cache-invalidation tail as the FormData version.
 */
export async function updateLinksPageFromJson(
  patch: LinksPagePatch,
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("links-page");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  // Validate the links payload up front so the transaction stays
  // small (we only touch the DB once everything's clean).
  let links: { title: string; url: string }[] | undefined;
  if (patch.links !== undefined) {
    if (patch.links.length > MAX_LINKS) {
      return {
        success: false,
        message: `Links limited to ${MAX_LINKS} entries.`,
      };
    }
    const cleaned: { title: string; url: string }[] = [];
    for (const raw of patch.links) {
      const title = (raw.title ?? "").trim();
      const url = (raw.url ?? "").trim();
      if (!title || !url) continue; // skip blank rows, like the web form does
      if (title.length > MAX_TITLE_LENGTH) {
        return {
          success: false,
          message: `Titles are limited to ${MAX_TITLE_LENGTH} characters.`,
        };
      }
      if (url.length > MAX_URL_LENGTH) {
        return { success: false, message: "URL is too long." };
      }
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return { success: false, message: `Invalid URL: ${url}` };
        }
      } catch {
        return { success: false, message: `Invalid URL: ${url}` };
      }
      cleaned.push({ title, url });
    }
    links = cleaned;
  }

  const userData: Record<string, unknown> = {};
  if (patch.enabled !== undefined) userData.linksPageEnabled = patch.enabled;
  if (patch.bio !== undefined) {
    const trimmed = (patch.bio ?? "").slice(0, MAX_BIO_LENGTH);
    userData.linksPageBio = trimmed.length > 0 ? trimmed : null;
  }
  if (patch.sensitiveLinks !== undefined) {
    userData.linksPageSensitiveLinks = patch.sensitiveLinks;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  });

  // Only run a transaction for the parts we're actually changing so a
  // "save just the bio" call doesn't wipe and reinsert every link row.
  // `$transaction` accepts either a callback or a `PrismaPromise[]`; we
  // use the array form so the ops are constructed eagerly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [];
  if (Object.keys(userData).length > 0) {
    ops.push(
      prisma.user.update({ where: { id: session.user.id }, data: userData }),
    );
  }
  if (links !== undefined) {
    ops.push(
      prisma.linksPageLink.deleteMany({ where: { userId: session.user.id } }),
    );
    links.forEach((link, i) => {
      ops.push(
        prisma.linksPageLink.create({
          data: {
            userId: session.user.id,
            title: link.title,
            url: link.url,
            order: i,
          },
        }),
      );
    });
  }
  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }

  if (user?.username) {
    revalidatePath(`/links/${user.username}`);
    revalidatePath(`/${user.username}`);
    await invalidate(cacheKeys.userProfile(user.username));
  }
  revalidatePath("/profile/links");

  return { success: true, message: "Links page updated" };
}

export async function updateLinksPage(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("links-page");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const enabled = formData.get("linksPageEnabled") === "on";
  const sensitiveLinks = formData.get("linksPageSensitiveLinks") === "on";
  const bio = (formData.get("linksPageBio") as string || "").slice(0, MAX_BIO_LENGTH);

  // Parse links from form data
  const links: { title: string; url: string }[] = [];
  const linkTitles = formData.getAll("linkTitle");
  const linkUrls = formData.getAll("linkUrl");

  for (let i = 0; i < linkTitles.length && i < MAX_LINKS; i++) {
    const title = (linkTitles[i] as string).trim();
    const url = (linkUrls[i] as string).trim();
    if (!title || !url) continue;

    // Validate URL scheme
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { success: false, message: `Invalid URL: ${url}` };
      }
    } catch {
      return { success: false, message: `Invalid URL: ${url}` };
    }

    links.push({ title, url });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        linksPageEnabled: enabled,
        linksPageBio: bio || null,
        linksPageSensitiveLinks: sensitiveLinks,
      },
    }),
    prisma.linksPageLink.deleteMany({
      where: { userId: session.user.id },
    }),
    ...links.map((link, i) =>
      prisma.linksPageLink.create({
        data: {
          userId: session.user.id,
          title: link.title,
          url: link.url,
          order: i,
        },
      })
    ),
  ]);

  if (user?.username) {
    revalidatePath(`/links/${user.username}`);
    revalidatePath(`/${user.username}`);
    await invalidate(cacheKeys.userProfile(user.username));
  }
  revalidatePath("/profile/links");

  return { success: true, message: "Links page updated!" };
}
