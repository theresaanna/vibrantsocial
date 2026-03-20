"use server";

import { auth } from "@/auth";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";import { prisma } from "@/lib/prisma";

async function enrichWithPendingFriendRequests(
  notifications: Array<{ type: string; actorId: string }>,
  currentUserId: string
): Promise<Set<string>> {
  const friendRequestActorIds = notifications
    .filter((n) => n.type === "FRIEND_REQUEST")
    .map((n) => n.actorId);

  if (friendRequestActorIds.length === 0) return new Set();

  const pendingRequests = await prisma.friendRequest.findMany({
    where: {
      senderId: { in: friendRequestActorIds },
      receiverId: currentUserId,
      status: "PENDING",
    },
    select: { senderId: true },
  });

  return new Set(pendingRequests.map((r) => r.senderId));
}

export async function getNotifications() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const notifications = await prisma.notification.findMany({
    where: { targetUserId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
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
      post: { select: { id: true, content: true } },
      message: { select: { id: true, conversationId: true } },
      tag: { select: { id: true, name: true } },
    },
  });

  const pendingActorIds = await enrichWithPendingFriendRequests(
    notifications,
    session.user.id
  );

  return notifications.map((n) => ({
    ...n,
    hasPendingFriendRequest:
      n.type === "FRIEND_REQUEST"
        ? pendingActorIds.has(n.actorId)
        : undefined,
  }));
}

export async function markNotificationRead(notificationId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `notif:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  await prisma.notification.updateMany({
    where: { id: notificationId, targetUserId: session.user.id },
    data: { readAt: new Date() },
  });

  return { success: true, message: "Marked as read" };
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `notif:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  await prisma.notification.updateMany({
    where: { targetUserId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return { success: true, message: "All marked as read" };
}

export async function getRecentNotifications() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const notifications = await prisma.notification.findMany({
    where: { targetUserId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 8,
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
      post: { select: { id: true, content: true } },
      message: { select: { id: true, conversationId: true } },
      tag: { select: { id: true, name: true } },
    },
  });

  const pendingActorIds = await enrichWithPendingFriendRequests(
    notifications,
    session.user.id
  );

  const enriched = notifications.map((n) => ({
    ...n,
    hasPendingFriendRequest:
      n.type === "FRIEND_REQUEST"
        ? pendingActorIds.has(n.actorId)
        : undefined,
  }));

  return JSON.parse(JSON.stringify(enriched));
}

export async function getUnreadNotificationCount() {
  const session = await auth();
  if (!session?.user?.id) return 0;

  return prisma.notification.count({
    where: { targetUserId: session.user.id, readAt: null },
  });
}

/**
 * Returns a map of { accountId: unreadCount } for all linked accounts
 * (excluding the current user).
 */
export async function getLinkedAccountNotificationCounts(): Promise<
  Record<string, number>
> {
  const session = await auth();
  if (!session?.user?.id) return {};

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { linkedAccountGroupId: true },
  });

  if (!user?.linkedAccountGroupId) return {};

  const linkedUsers = await prisma.user.findMany({
    where: {
      linkedAccountGroupId: user.linkedAccountGroupId,
      id: { not: session.user.id },
    },
    select: { id: true },
  });

  if (linkedUsers.length === 0) return {};

  const linkedIds = linkedUsers.map((u: { id: string }) => u.id);

  const [notifCounts, chatParticipants] = await Promise.all([
    prisma.notification.groupBy({
      by: ["targetUserId"],
      where: { targetUserId: { in: linkedIds }, readAt: null },
      _count: { id: true },
    }),
    // Get unread chat counts: conversations where lastReadAt < last message time
    prisma.conversationParticipant.findMany({
      where: { userId: { in: linkedIds } },
      select: {
        userId: true,
        lastReadAt: true,
        conversation: {
          select: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
          },
        },
      },
    }),
  ]);

  const result: Record<string, number> = {};
  for (const id of linkedIds) {
    result[id] = 0;
  }
  for (const row of notifCounts) {
    result[row.targetUserId] = row._count.id;
  }

  // Add unread chat message counts
  for (const cp of chatParticipants) {
    const lastMessage = cp.conversation.messages[0];
    if (lastMessage) {
      const hasUnread = !cp.lastReadAt || lastMessage.createdAt > cp.lastReadAt;
      if (hasUnread) {
        result[cp.userId] = (result[cp.userId] ?? 0) + 1;
      }
    }
  }

  return result;
}
