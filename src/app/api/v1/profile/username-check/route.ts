/**
 * Mobile version of `/api/username-check` — uses bearer-token auth so
 * the "available because you already own it" branch works for Flutter
 * callers (the web route calls `auth()` which returns null for mobile).
 *
 *   GET /api/v1/profile/username-check?username=theresa
 *     → { available: boolean }
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  const username = new URL(req.url).searchParams.get("username") ?? "";

  // Reuse the same shape the web route enforces so a handle valid here
  // is valid there.
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return corsJson(req, { available: false });
  }

  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  const available = !existing || existing.id === viewer.userId;
  return corsJson(req, { available });
}
