import { prisma } from "@/lib/prisma";
import { getAblyRestClient } from "@/lib/ably";
import { sendPushNotification } from "@/lib/web-push";
import { sendExpoPushNotification } from "@/lib/expo-push";
import type { NotificationType } from "@/generated/prisma/client";
import { invalidateMany, cacheKeys } from "@/lib/cache";

const MAX_NOTIFICATIONS = 50;

interface CreateNotificationParams {
  type: NotificationType;
  actorId: string;
  targetUserId: string;
  postId?: string;
  commentId?: string;
  messageId?: string;
  repostId?: string;
  tagId?: string;
  userListId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  const { type, actorId, targetUserId, postId, commentId, messageId, repostId, tagId, userListId } = params;

  // Don't notify yourself (except system notifications like milestones)
  if (actorId === targetUserId && type !== "STARS_MILESTONE") return;

  // Don't notify if a block exists between the two users
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: actorId, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: actorId },
      ],
    },
  });
  if (block) return;

  const notification = await prisma.notification.create({
    data: { type, actorId, targetUserId, postId, commentId, messageId, repostId, tagId, userListId },
    include: {
      actor: {
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          image: true,
          avatar: true,
          profileFrameId: true,
          usernameFont: true,
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

  // Invalidate notification caches for the target user
  try {
    await invalidateMany([
      cacheKeys.userNotifications(targetUserId),
      cacheKeys.userRecentNotifications(targetUserId),
      cacheKeys.unreadNotificationCount(targetUserId),
    ]);
  } catch {
    // Non-critical
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
      repostId: notification.repostId,
      tagId: notification.tagId,
      createdAt: notification.createdAt.toISOString(),
    });
  } catch {
    // Non-critical — DB write succeeded
  }

  // Build push notification body (shared between web and Expo push)
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
    FRIEND_REQUEST_ACCEPTED: "accepted your friend request",
    NEW_POST: "published a new post",
    TAG_POST: "posted in a tag you follow",
    REFERRAL_SIGNUP: "joined using your referral link! You earned 50 stars",
    STARS_MILESTONE: "You have 500+ stars! Redeem them for a free month of premium",
    LIST_ADD: "added you to a list",
    LIST_SUBSCRIBE: "subscribed to your list",
    LIST_COLLABORATOR_ADD: "added you as a collaborator on a list",
    MARKETPLACE_QUESTION: "asked a question on your listing",
    MARKETPLACE_ANSWER: "answered your question on a listing",
    CHAT_REQUEST: "sent you a chat request",
    CHAT_REQUEST_ACCEPTED: "accepted your chat request",
    CHAT_ABUSE: "may be sending you abusive messages",
    SUBSCRIBED_COMMENT: "commented on a post you're subscribed to",
    LIST_JOIN_REQUEST: "requested to join your list",
    CHATROOM_MENTION: "mentioned you in the chat room",
  };
  const pushBody = `${actorName} ${typeText[type] || "sent you a notification"}`;

  // Send web push notification
  try {
    const url = postId ? `/notifications` : "/notifications";
    await sendPushNotification(targetUserId, {
      title: "VibrantSocial",
      body: pushBody,
      url,
    });
  } catch {
    // Non-critical — DB write and Ably succeeded
  }

  // Send Expo push notification (mobile app)
  try {
    await sendExpoPushNotification(targetUserId, {
      title: "VibrantSocial",
      body: pushBody,
      data: {
        type,
        postId: postId ?? null,
        commentId: commentId ?? null,
        actorId,
      },
    });
  } catch {
    // Non-critical
  }

  return notification;
}
