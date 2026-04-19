/**
 * AI-generated color palette from a background image.
 *
 * POST /api/v1/theme/generate
 *   { imageUrl: string }
 *   → { success, name?, colors?, error? }
 *
 * Thin wrapper over the web `generateTheme` server action — we don't
 * duplicate the Anthropic call here, just re-authenticate the mobile
 * viewer into a cookie-shaped session (via require-viewer's
 * `getSessionFromRequest`) so the action's `auth()` picks up the
 * correct user id.
 */
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { generateThemeForUser } from "@/app/theme/generate-theme-action";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  let body: { imageUrl?: string };
  try {
    body = (await req.json()) as { imageUrl?: string };
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }
  const imageUrl = body.imageUrl?.trim();
  if (!imageUrl) {
    return corsJson(req, { error: "imageUrl required" }, { status: 400 });
  }

  // `generateThemeForUser` is the auth-free core exposed for mobile —
  // `generateTheme` itself looks up the NextAuth cookie which isn't
  // present on Bearer-authenticated calls.
  const result = await generateThemeForUser(viewer.userId, imageUrl);
  if (!result.success) {
    return corsJson(req, { error: result.error }, { status: 400 });
  }
  return corsJson(req, {
    name: result.name,
    colors: result.light,
  });
}
