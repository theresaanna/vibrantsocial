/**
 * Like / unlike a post.
 *
 * POST   /api/v1/post/:id/like → idempotent create
 * DELETE /api/v1/post/:id/like → idempotent remove
 *
 * Both return `{ liked: boolean, likes: number }` so the client can
 * reconcile its optimistic count without a second request. Requires a
 * valid session; anonymous callers get 401.
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
  if (!post) {
    return corsJson(req, { error: "Post not found" }, { status: 404 });
  }

  await prisma.like.upsert({
    where: { postId_userId: { postId: id, userId: viewer.userId } },
    create: { postId: id, userId: viewer.userId },
    update: {},
  });
  const likes = await prisma.like.count({ where: { postId: id } });
  return corsJson(req, { liked: true, likes });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const { id } = await params;

  await prisma.like.deleteMany({
    where: { postId: id, userId: viewer.userId },
  });
  const likes = await prisma.like.count({ where: { postId: id } });
  return corsJson(req, { liked: false, likes });
}

