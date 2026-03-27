"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cached, invalidate, cacheKeys } from "@/lib/cache";
import { requireAuthWithRateLimit, isActionError, areFriends, USER_PROFILE_SELECT } from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";

export async function addCloseFriend(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("close-friend");
  if (isActionError(result)) return result;
  const session = result;

  const friendId = formData.get("friendId") as string;
  if (!friendId) {
    return { success: false, message: "Friend ID required" };
  }

  if (friendId === session.user.id) {
    return { success: false, message: "Cannot add yourself" };
  }

  // Verify they are actually friends (accepted friend request)
  if (!(await areFriends(session.user.id, friendId))) {
    return { success: false, message: "You must be friends first" };
  }

  const existing = await prisma.closeFriend.findUnique({
    where: { userId_friendId: { userId: session.user.id, friendId } },
  });

  if (existing) {
    return { success: false, message: "Already on your close friends list" };
  }

  await prisma.closeFriend.create({
    data: { userId: session.user.id, friendId },
  });

  await Promise.all([
    invalidate(cacheKeys.userCloseFriendIds(session.user.id)),
    invalidate(cacheKeys.userCloseFriendOf(friendId)),
  ]);

  revalidatePath("/close-friends");
  return { success: true, message: "Added to close friends" };
}

export async function removeCloseFriend(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("close-friend");
  if (isActionError(result)) return result;
  const session = result;

  const friendId = formData.get("friendId") as string;
  if (!friendId) {
    return { success: false, message: "Friend ID required" };
  }

  const existing = await prisma.closeFriend.findUnique({
    where: { userId_friendId: { userId: session.user.id, friendId } },
  });

  if (!existing) {
    return { success: false, message: "Not on your close friends list" };
  }

  await prisma.closeFriend.delete({ where: { id: existing.id } });

  await Promise.all([
    invalidate(cacheKeys.userCloseFriendIds(session.user.id)),
    invalidate(cacheKeys.userCloseFriendOf(friendId)),
  ]);

  revalidatePath("/close-friends");
  return { success: true, message: "Removed from close friends" };
}

export async function getCloseFriends() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.closeFriend.findMany({
    where: { userId: session.user.id },
    include: {
      friend: {
        select: USER_PROFILE_SELECT,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCloseFriendIds(userId: string): Promise<string[]> {
  return cached(
    cacheKeys.userCloseFriendIds(userId),
    async () => {
      const rows = await prisma.closeFriend.findMany({
        where: { userId },
        select: { friendId: true },
      });
      return rows.map((r: { friendId: string }) => r.friendId);
    },
    120
  );
}

/**
 * Get IDs of users who have added the given user as a close friend (cached).
 * Used to determine which close-friends-only posts the user can see.
 */
export async function getCachedCloseFriendOfIds(userId: string): Promise<string[]> {
  return cached(
    cacheKeys.userCloseFriendOf(userId),
    async () => {
      const rows = await prisma.closeFriend.findMany({
        where: { friendId: userId },
        select: { userId: true },
      });
      return rows.map((r: { userId: string }) => r.userId);
    },
    120
  );
}

export async function isCloseFriend(
  userId: string,
  friendId: string
): Promise<boolean> {
  const record = await prisma.closeFriend.findUnique({
    where: { userId_friendId: { userId, friendId } },
  });
  return !!record;
}

export async function getAcceptedFriends() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const friendships = await prisma.friendRequest.findMany({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: session.user.id },
        { receiverId: session.user.id },
      ],
    },
    include: {
      sender: {
        select: USER_PROFILE_SELECT,
      },
      receiver: {
        select: USER_PROFILE_SELECT,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Return the other person in each friendship
  return friendships.map((f) =>
    f.senderId === session.user!.id ? f.receiver : f.sender
  );
}
