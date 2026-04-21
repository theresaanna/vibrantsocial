/**
 * Remove a wall post entirely.
 *
 *   DELETE /api/v1/wall/:id  → { ok }
 *
 * Either the post author or the wall owner can delete. Cascades the
 * underlying `Post` via the `WallPost.postId` FK (`onDelete: Cascade`
 * on the relation side), so removing the Post removes the wall row
 * too — we hit Post directly to keep the cascade one-sided.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { revalidatePath } from "next/cache";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function DELETE(
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

  const wallPost = await prisma.wallPost.findUnique({
    where: { id },
    select: {
      id: true,
      wallOwnerId: true,
      postId: true,
      post: { select: { authorId: true } },
      wallOwner: { select: { username: true } },
    },
  });
  if (!wallPost) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }

  const allowed =
    wallPost.wallOwnerId === viewerId || wallPost.post.authorId === viewerId;
  if (!allowed) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: corsHeaders(req) },
    );
  }

  // Remove the underlying Post; the WallPost row cascades via FK.
  await prisma.post.delete({ where: { id: wallPost.postId } });

  if (wallPost.wallOwner.username) {
    revalidatePath(`/${wallPost.wallOwner.username}`);
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders(req) });
}
