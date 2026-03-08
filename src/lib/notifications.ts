import { prisma } from "@/lib/prisma";
import { getAblyRestClient } from "@/lib/ably";
import { sendPushNotification } from "@/lib/web-push";
import type { NotificationType } from "@/generated/prisma/client";

const MAX_NOTIFICATIONS = 50;

interface CreateNotificationParams {
  type: NotificationType;
  actorId: string;
  targetUserId: string;
  postId?: string;
  commentId?: string;
  messageId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  const { type, actorId, targetUserId, postId, commentId, messageId } = params;

  // Don't notify yourself
  if (actorId === targetUserId) return;

  const notification = await prisma.notification.create({
    data: { type, actorId, targetUserId, postId, commentId, messageId },
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
      where: { id: { in: oldest.map((n: { id: string }) => n.id) } },
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
      messageId: notification.messageId,
      createdAt: notification.createdAt.toISOString(),
    });
  } catch {
    // Non-critical — DB write succeeded
  }

  // Send web push notification
  try {
    const actorName =
      notification.actor.displayName ||
      notification.actor.username ||
      notification.actor.name ||
      "Someone";
    const typeText: Record<string, string> = {
      LIKE: "liked your post",
      COMMENT: "commented on your post",
      REPLY: "replied to your comment",
      REPOST: "reposted your post",
      BOOKMARK: "bookmarked your post",
      FOLLOW: "followed you",
      REACTION: "reacted to your message",
      MENTION: "mentioned you",
      FRIEND_REQUEST: "sent you a friend request",
    };
    const body = `${actorName} ${typeText[type] || "sent you a notification"}`;
    const url = postId ? `/notifications` : "/notifications";
    await sendPushNotification(targetUserId, {
      title: "VibrantSocial",
      body,
      url,
    });
  } catch {
    // Non-critical — DB write and Ably succeeded
  }

  return notification;
}
