/**
 * Wall-owner moderation action for a single wall post.
 *
 *   PATCH /api/v1/wall/:id/status  body: { status: "accepted" | "hidden" }
 *     → { ok, status }
 *
 * Only the wall owner can change status. `pending → accepted` makes the
 * post visible to everyone; `accepted → hidden` takes it down but
 * doesn't delete the underlying Post (the author can still see it on
 * their own timeline).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { revalidatePath } from "next/cache";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders(req) },
    );
  }
  const viewerId = session.user.id;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders(req) },
    );
  }
  const status = (body as Record<string, unknown> | null)?.status;
  if (status !== "accepted" && status !== "hidden") {
    return NextResponse.json(
      { error: "status must be 'accepted' or 'hidden'" },
      { status: 400, headers: corsHeaders(req) },
    );
  }

  const wallPost = await prisma.wallPost.findUnique({
    where: { id },
    select: {
      id: true,
      wallOwnerId: true,
      wallOwner: { select: { username: true } },
    },
  });
  if (!wallPost || wallPost.wallOwnerId !== viewerId) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }

  const updated = await prisma.wallPost.update({
    where: { id },
    data: { status },
    select: { id: true, status: true },
  });

  if (wallPost.wallOwner.username) {
    revalidatePath(`/${wallPost.wallOwner.username}`);
  }

  return NextResponse.json(
    { ok: true, status: updated.status },
    { headers: corsHeaders(req) },
  );
}
