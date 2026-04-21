/**
 * Repost / unrepost a post.
 *
 *   POST   /api/v1/post/:id/repost → idempotent create
 *   DELETE /api/v1/post/:id/repost → idempotent remove
 *
 * Both return `{ reposted: boolean, reposts: number }` so the client
 * reconciles its optimistic count without a second request.
 *
 * Mirrors the web's `toggleRepost` server action (`src/app/feed/
 * post-actions.ts:214`) — only counts "straight" reposts (not quote
 * reposts, which have `quotedRepostId` set). Stars are bumped /
 * decremented to match the web path, and a `REPOST` notification fires
 * on first-time repost.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { createNotification } from "@/lib/notifications";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

async function countStraightReposts(postId: string) {
  return prisma.repost.count({
    where: { postId, quotedRepostId: null },
  });
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
    select: { authorId: true },
  });
  if (!post) {
    return corsJson(req, { error: "Post not found" }, { status: 404 });
  }

  // Idempotent: if the viewer already has a straight repost of this
  // post, do nothing extra — but still return the canonical
  // "reposted" state so the client stays in sync.
  const existing = await prisma.repost.findFirst({
    where: { postId: id, userId: viewer.userId, quotedRepostId: null },
    select: { id: true },
  });
  if (!existing) {
    await prisma.repost.create({
      data: { postId: id, userId: viewer.userId },
    });
    await prisma.user.update({
      where: { id: viewer.userId },
      data: { stars: { increment: 1 } },
    });
    if (post.authorId && post.authorId !== viewer.userId) {
      // Notify the author. Wrap in try/catch in case the Notification
      // schema rejects anything (we learned our lesson with the FK
      // mismatch on CHATROOM_MENTION — be defensive).
      try {
        await createNotification({
          type: "REPOST",
          actorId: viewer.userId,
          targetUserId: post.authorId,
          postId: id,
        });
      } catch (err) {
        console.error("[repost] notify failed:", err);
      }
    }
  }

  const reposts = await countStraightReposts(id);
  return corsJson(req, { reposted: true, reposts });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const { id } = await params;

  const existing = await prisma.repost.findFirst({
    where: { postId: id, userId: viewer.userId, quotedRepostId: null },
    select: { id: true },
  });
  if (existing) {
    await prisma.repost.delete({ where: { id: existing.id } });
    await prisma.user.update({
      where: { id: viewer.userId },
      data: { stars: { decrement: 1 } },
    });
  }

  const reposts = await countStraightReposts(id);
  return corsJson(req, { reposted: false, reposts });
}
