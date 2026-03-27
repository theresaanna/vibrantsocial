"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cached, invalidate, cacheKeys } from "@/lib/cache";
import { requireAuthWithRateLimit, isActionError } from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";

/**
 * Get IDs of users the given user has blocked (cached).
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  return cached(
    cacheKeys.userBlockedIds(userId),
    async () => {
      const blocks = await prisma.block.findMany({
        where: { blockerId: userId },
        select: { blockedId: true },
      });
      return blocks.map((b: { blockedId: string }) => b.blockedId);
    },
    60
  );
}

/**
 * Get IDs of users who have blocked the given user (cached).
 */
export async function getBlockedByUserIds(userId: string): Promise<string[]> {
  return cached(
    `user:${userId}:blocked-by`,
    async () => {
      const blocks = await prisma.block.findMany({
        where: { blockedId: userId },
        select: { blockerId: true },
      });
      return blocks.map((b: { blockerId: string }) => b.blockerId);
    },
    60
  );
}

/**
 * Get all user IDs involved in any block relationship with the given user
 * (either direction). Used for filtering feeds, search, etc.
 */
export async function getAllBlockRelatedIds(userId: string): Promise<string[]> {
  const [blockedIds, blockedByIds] = await Promise.all([
    getBlockedUserIds(userId),
    getBlockedByUserIds(userId),
  ]);
  return [...new Set([...blockedIds, ...blockedByIds])];
}

/**
 * Check the block relationship between the current user and a target.
 */
export async function getBlockStatus(
  targetUserId: string
): Promise<"none" | "blocked_by_me" | "blocked_by_them"> {
  const session = await auth();
  if (!session?.user?.id) return "none";

  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: session.user.id, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: session.user.id },
      ],
    },
    select: { blockerId: true },
  });

  if (!block) return "none";
  return block.blockerId === session.user.id ? "blocked_by_me" : "blocked_by_them";
}

/**
 * Toggle block on a user. When blocking, also removes mutual follows,
 * friend requests, post subscriptions, and close friend entries.
 */
export async function toggleBlock(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("block");
  if (isActionError(result)) return result;
  const session = result;

  const targetUserId = formData.get("userId") as string;

  if (targetUserId === session.user.id) {
    return { success: false, message: "Cannot block yourself" };
  }

  const existing = await prisma.block.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: session.user.id,
        blockedId: targetUserId,
      },
    },
  });

  if (existing) {
    // Unblock
    await prisma.block.delete({ where: { id: existing.id } });
  } else {
    // Block — also clean up all mutual relationships
    await prisma.$transaction([
      prisma.block.create({
        data: { blockerId: session.user.id, blockedId: targetUserId },
      }),
      // Remove mutual follows
      prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: session.user.id, followingId: targetUserId },
            { followerId: targetUserId, followingId: session.user.id },
          ],
        },
      }),
      // Remove friend requests in either direction
      prisma.friendRequest.deleteMany({
        where: {
          OR: [
            { senderId: session.user.id, receiverId: targetUserId },
            { senderId: targetUserId, receiverId: session.user.id },
          ],
        },
      }),
      // Remove post subscriptions
      prisma.postSubscription.deleteMany({
        where: {
          OR: [
            { subscriberId: session.user.id, subscribedToId: targetUserId },
            { subscriberId: targetUserId, subscribedToId: session.user.id },
          ],
        },
      }),
      // Remove close friend entries
      prisma.closeFriend.deleteMany({
        where: {
          OR: [
            { userId: session.user.id, friendId: targetUserId },
            { userId: targetUserId, friendId: session.user.id },
          ],
        },
      }),
    ]);
  }

  // Invalidate caches for both users
  try {
    const [currentUserData, targetUserData] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.user.id }, select: { username: true } }),
      prisma.user.findUnique({ where: { id: targetUserId }, select: { username: true } }),
    ]);

    const invalidations = [
      invalidate(cacheKeys.userBlockedIds(session.user.id)),
      invalidate(cacheKeys.userBlockedIds(targetUserId)),
      invalidate(cacheKeys.userFollowing(session.user.id)),
      invalidate(cacheKeys.userFollowing(targetUserId)),
    ];
    if (currentUserData?.username) {
      invalidations.push(invalidate(cacheKeys.userProfile(currentUserData.username)));
    }
    if (targetUserData?.username) {
      invalidations.push(invalidate(cacheKeys.userProfile(targetUserData.username)));
    }
    await Promise.all(invalidations);
  } catch {
    // Non-critical
  }

  revalidatePath("/");
  return { success: true, message: existing ? "Unblocked" : "Blocked" };
}
