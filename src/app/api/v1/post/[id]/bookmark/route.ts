/**
 * Bookmark / unbookmark a post.
 *
 * POST   /api/v1/post/:id/bookmark → idempotent add
 * DELETE /api/v1/post/:id/bookmark → idempotent remove
 *
 * Returns `{ bookmarked: boolean, bookmarks: number }`.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!post) return corsJson(req, { error: "Post not found" }, { status: 404 });

  await prisma.bookmark.upsert({
    where: { postId_userId: { postId: id, userId: viewer.userId } },
    create: { postId: id, userId: viewer.userId },
    update: {},
  });
  const bookmarks = await prisma.bookmark.count({ where: { postId: id } });
  return corsJson(req, { bookmarked: true, bookmarks });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const { id } = await params;

  await prisma.bookmark.deleteMany({
    where: { postId: id, userId: viewer.userId },
  });
  const bookmarks = await prisma.bookmark.count({ where: { postId: id } });
  return corsJson(req, { bookmarked: false, bookmarks });
}
