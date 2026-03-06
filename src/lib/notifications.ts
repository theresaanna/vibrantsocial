import { prisma } from "@/lib/prisma";
import { getAblyRestClient } from "@/lib/ably";
import type { NotificationType } from "@/generated/prisma";

const MAX_NOTIFICATIONS = 50;

interface CreateNotificationParams {
  type: NotificationType;
  actorId: string;
  targetUserId: string;
  postId?: string;
  commentId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  const { type, actorId, targetUserId, postId, commentId } = params;

  // Don't notify yourself
  if (actorId === targetUserId) return;

  const notification = await prisma.notification.create({
    data: { type, actorId, targetUserId, postId, commentId },
    include: {
      actor: {
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          image: true,
          avatar: true,
        },
      },
    },
  });

  // Enforce 50-record cap — delete oldest beyond limit
  const count = await prisma.notification.count({
    where: { targetUserId },
  });

  if (count > MAX_NOTIFICATIONS) {
    const oldest = await prisma.notification.findMany({
      where: { targetUserId },
      orderBy: { createdAt: "asc" },
      take: count - MAX_NOTIFICATIONS,
      select: { id: true },
    });

    await prisma.notification.deleteMany({
      where: { id: { in: oldest.map((n) => n.id) } },
    });
  }

  // Publish to Ably for real-time delivery
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`notifications:${targetUserId}`);
    await channel.publish("new", {
      id: notification.id,
      type: notification.type,
      actorId: notification.actorId,
      actor: JSON.stringify(notification.actor),
      postId: notification.postId,
      commentId: notification.commentId,
      createdAt: notification.createdAt.toISOString(),
    });
  } catch {
    // Non-critical — DB write succeeded
  }

  return notification;
}
