/**
 * Subscribe / unsubscribe to a user list.
 *
 * POST   /api/v1/lists/:id/subscribe  → { subscribed: true }
 * DELETE /api/v1/lists/:id/subscribe  → { subscribed: false }
 *
 * Mirrors the `toggleListSubscription` server action — same guards
 * (can't sub to your own, can't sub to a private list unless already
 * a member/collab) and the same `LIST_SUBSCRIBE` notification side
 * effect on first subscribe.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { createNotificationSafe } from "@/lib/action-utils";
import { invalidate, cacheKeys } from "@/lib/cache";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

async function canSubscribe(listId: string, userId: string) {
  const list = await prisma.userList.findUnique({
    where: { id: listId },
    select: { ownerId: true, isPrivate: true },
  });
  if (!list) return { ok: false as const, status: 404, message: "Not found" };
  if (list.ownerId === userId) {
    return { ok: false as const, status: 400, message: "You own this list" };
  }
  if (list.isPrivate) {
    const [member, collab] = await Promise.all([
      prisma.userListMember.findUnique({
        where: { listId_userId: { listId, userId } },
      }),
      prisma.userListCollaborator.findUnique({
        where: { listId_userId: { listId, userId } },
      }),
    ]);
    if (!member && !collab) {
      return { ok: false as const, status: 403, message: "Private list" };
    }
  }
  return { ok: true as const, ownerId: list.ownerId };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const userId = viewer.userId;
  const { id } = await params;

  const check = await canSubscribe(id, userId);
  if (!check.ok) {
    return corsJson(req, { error: check.message }, { status: check.status });
  }

  const existing = await prisma.userListSubscription.findUnique({
    where: { listId_userId: { listId: id, userId } },
  });
  if (!existing) {
    await prisma.userListSubscription.create({
      data: { listId: id, userId },
    });
    await createNotificationSafe({
      type: "LIST_SUBSCRIBE",
      actorId: userId,
      targetUserId: check.ownerId,
    });
  }
  await invalidate(cacheKeys.userListSubscriptions(userId));
  return corsJson(req, { subscribed: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const userId = viewer.userId;
  const { id } = await params;

  await prisma.userListSubscription.deleteMany({
    where: { listId: id, userId },
  });
  await invalidate(cacheKeys.userListSubscriptions(userId));
  return corsJson(req, { subscribed: false });
}
