"use server";

import { auth } from "@/auth";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cached, invalidate, cacheKeys } from "@/lib/cache";

interface BlockState {
  success: boolean;
  message: string;
}

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
  _prevState: BlockState,
  formData: FormData
): Promise<BlockState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `block:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const targetUserId = formData.get("userId") as string;
  const blockByPhone = formData.get("blockByPhone") === "true";

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
    const blockTargetIds = [targetUserId];

    // If blocking by phone, find all accounts sharing the same verified phone
    if (blockByPhone) {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { phoneNumber: true, phoneVerified: true },
      });

      if (targetUser?.phoneNumber && targetUser.phoneVerified) {
        const phoneUsers = await prisma.user.findMany({
          where: {
            phoneNumber: targetUser.phoneNumber,
            phoneVerified: { not: null },
            id: { notIn: [session.user.id, targetUserId] },
          },
          select: { id: true },
        });
        blockTargetIds.push(...phoneUsers.map((u: { id: string }) => u.id));

        // Record the phone block for future account enforcement
        await prisma.phoneBlock.upsert({
          where: {
            blockerId_phoneNumber: {
              blockerId: session.user.id,
              phoneNumber: targetUser.phoneNumber,
            },
          },
          update: {},
          create: {
            blockerId: session.user.id,
            phoneNumber: targetUser.phoneNumber,
          },
        });
      }
    }

    await prisma.$transaction(
      blockTargetIds.flatMap((blockedId) => [
        prisma.block.upsert({
          where: {
            blockerId_blockedId: { blockerId: session.user.id, blockedId },
          },
          update: {},
          create: { blockerId: session.user.id, blockedId },
        }),
        prisma.follow.deleteMany({
          where: {
            OR: [
              { followerId: session.user.id, followingId: blockedId },
              { followerId: blockedId, followingId: session.user.id },
            ],
          },
        }),
        prisma.friendRequest.deleteMany({
          where: {
            OR: [
              { senderId: session.user.id, receiverId: blockedId },
              { senderId: blockedId, receiverId: session.user.id },
            ],
          },
        }),
        prisma.postSubscription.deleteMany({
          where: {
            OR: [
              { subscriberId: session.user.id, subscribedToId: blockedId },
              { subscriberId: blockedId, subscribedToId: session.user.id },
            ],
          },
        }),
        prisma.closeFriend.deleteMany({
          where: {
            OR: [
              { userId: session.user.id, friendId: blockedId },
              { userId: blockedId, friendId: session.user.id },
            ],
          },
        }),
      ])
    );
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
