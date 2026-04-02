"use server";

import { prisma } from "@/lib/prisma";
import { requireAuthWithRateLimit, isActionError } from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";
import { invalidate, cacheKeys } from "@/lib/cache";

const MAX_LINKS = 50;
const MAX_BIO_LENGTH = 300;

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
