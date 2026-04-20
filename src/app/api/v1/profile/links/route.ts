/**
 * Viewer's /@username links page — the same data `/profile/links`
 * edits on web, exposed as a typed JSON API for the Flutter client.
 *
 * Deliberately does NOT surface the `linksPageSensitiveLinks` in-app-
 * browser-hiding toggle on mobile (the edit screen scope intentionally
 * stays Play-reviewer-neutral — "sensitive" in the flag name reads as
 * content-moderation even though it's actually anti-scraping).
 * `updateLinksPageFromJson` leaves the stored value untouched when the
 * client doesn't send the key.
 */
import { corsJson, corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { withMobileSession } from "@/lib/mobile-session-context";
import { NextResponse } from "next/server";
import {
  getMyLinksPage,
  updateLinksPageFromJson,
  type LinksPagePatch,
} from "@/app/profile/links/actions";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders(req) },
    );
  }

  // `getMyLinksPage` delegates to `requireAuthWithRateLimit`, which
  // falls back to the AsyncLocalStorage mobile session when the cookie-
  // based `auth()` returns null. Seed that storage from the bearer
  // token so the fallback actually fires.
  const data = await withMobileSession(session, () => getMyLinksPage());
  if (!data) return corsJson(req, { error: "Not found" }, { status: 404 });

  return corsJson(req, {
    enabled: data.enabled,
    bio: data.bio,
    links: data.links.map((l) => ({ id: l.id, title: l.title, url: l.url })),
  });
}

// Keys the mobile client is allowed to PUT. Any other key in the body
// is silently dropped so an unexpected payload can't clobber state
// (e.g. `sensitiveLinks`, which the mobile UI doesn't surface).
const WRITABLE_STRING_OR_NULL = ["bio"] as const;
const WRITABLE_BOOLEAN = ["enabled"] as const;

export async function PUT(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders(req) },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return corsJson(req, { error: "Invalid body" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const patch: LinksPagePatch = {};

  for (const k of WRITABLE_BOOLEAN) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    const v = raw[k];
    if (typeof v !== "boolean") {
      return corsJson(req, { error: `${k} must be a boolean` }, { status: 400 });
    }
    (patch as Record<string, unknown>)[k] = v;
  }
  for (const k of WRITABLE_STRING_OR_NULL) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    const v = raw[k];
    if (v !== null && typeof v !== "string") {
      return corsJson(
        req,
        { error: `${k} must be a string or null` },
        { status: 400 },
      );
    }
    (patch as Record<string, unknown>)[k] = v;
  }

  if (Object.prototype.hasOwnProperty.call(raw, "links")) {
    const v = raw.links;
    if (!Array.isArray(v)) {
      return corsJson(req, { error: "links must be an array" }, { status: 400 });
    }
    const cleaned: { title: string; url: string }[] = [];
    for (const entry of v) {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof (entry as { title?: unknown }).title !== "string" ||
        typeof (entry as { url?: unknown }).url !== "string"
      ) {
        return corsJson(
          req,
          { error: "each link needs a title and url string" },
          { status: 400 },
        );
      }
      cleaned.push({
        title: (entry as { title: string }).title,
        url: (entry as { url: string }).url,
      });
    }
    patch.links = cleaned;
  }

  const result = await withMobileSession(session, () =>
    updateLinksPageFromJson(patch),
  );
  if (!result.success) {
    return corsJson(req, { error: result.message }, { status: 400 });
  }
  return corsJson(req, { ok: true, message: result.message });
}
