"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getNotifications() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.notification.findMany({
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
        },
      },
      post: { select: { id: true, content: true } },
      message: { select: { id: true, conversationId: true } },
      tag: { select: { id: true, name: true } },
    },
  });
}

export async function markNotificationRead(notificationId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
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
        },
      },
      post: { select: { id: true, content: true } },
      message: { select: { id: true, conversationId: true } },
      tag: { select: { id: true, name: true } },
    },
  });

  return JSON.parse(JSON.stringify(notifications));
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

  const linkedIds = linkedUsers.map((u) => u.id);

  const counts = await prisma.notification.groupBy({
    by: ["targetUserId"],
    where: { targetUserId: { in: linkedIds }, readAt: null },
    _count: { id: true },
  });

  const result: Record<string, number> = {};
  for (const id of linkedIds) {
    result[id] = 0;
  }
  for (const row of counts) {
    result[row.targetUserId] = row._count.id;
  }
  return result;
}
