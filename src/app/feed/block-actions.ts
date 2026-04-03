"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cached, invalidate, invalidateMany, cacheKeys } from "@/lib/cache";
import { requireAuthWithRateLimit, isActionError } from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";

/**
 * Get IDs of users the given user has blocked (cached).
 * Includes both direct blocks and phone-number-based blocks.
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  return cached(
    cacheKeys.userBlockedIds(userId),
    async () => {
      const [directBlocks, phoneBlocks] = await Promise.all([
        prisma.block.findMany({
          where: { blockerId: userId },
          select: { blockedId: true },
        }),
        // Find users whose phone matches any PhoneBlock the user has created
        prisma.phoneBlock.findMany({
          where: { blockerId: userId },
          select: { phoneNumber: true },
        }),
      ]);

      const directIds = directBlocks.map((b) => b.blockedId);

      if (phoneBlocks.length === 0) return directIds;

      // Find all users with matching verified phone numbers
      const phoneNumbers = phoneBlocks.map((pb) => pb.phoneNumber);
      const phoneUsers = await prisma.user.findMany({
        where: {
          phoneNumber: { in: phoneNumbers },
          phoneVerified: { not: null },
          id: { not: userId }, // exclude self
        },
        select: { id: true },
      });

      return [...new Set([...directIds, ...phoneUsers.map((u) => u.id)])];
    },
    60
  );
}

/**
 * Get IDs of users who have blocked the given user (cached).
 * Includes both direct blocks and phone-number-based blocks.
 */
export async function getBlockedByUserIds(userId: string): Promise<string[]> {
  return cached(
    cacheKeys.userBlockedByIds(userId),
    async () => {
      const [directBlocks, currentUser] = await Promise.all([
        prisma.block.findMany({
          where: { blockedId: userId },
          select: { blockerId: true },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { phoneNumber: true, phoneVerified: true },
        }),
      ]);

      const directIds = directBlocks.map((b) => b.blockerId);

      // If this user has a verified phone, check if anyone has phone-blocked that number
      if (!currentUser?.phoneNumber || !currentUser.phoneVerified) return directIds;

      const phoneBlockers = await prisma.phoneBlock.findMany({
        where: {
          phoneNumber: currentUser.phoneNumber,
          blockerId: { not: userId },
        },
        select: { blockerId: true },
      });

      return [...new Set([...directIds, ...phoneBlockers.map((pb) => pb.blockerId)])];
    },
    60
  );
}

/**
 * Get all user IDs involved in any block relationship with the given user
 * (either direction). Cached as a single key to avoid 2 sequential lookups.
 */
export async function getAllBlockRelatedIds(userId: string): Promise<string[]> {
  return cached(
    cacheKeys.userAllBlocks(userId),
    async () => {
      const [blockedIds, blockedByIds] = await Promise.all([
        getBlockedUserIds(userId),
        getBlockedByUserIds(userId),
      ]);
      return [...new Set([...blockedIds, ...blockedByIds])];
    },
    120
  );
}

/**
 * Instantly invalidate all block-related caches for a user.
 * Called on block/unblock to ensure real-time accuracy.
 */
export async function invalidateBlockCaches(userId: string) {
  await invalidateMany([
    cacheKeys.userBlockedIds(userId),
    cacheKeys.userBlockedByIds(userId),
    cacheKeys.userAllBlocks(userId),
  ]);
}

/**
 * Get full user objects for all users the current user has blocked.
 * Used by the /blocked page to display the list with unblock buttons.
 */
export async function getBlockedUsers() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const blockedIds = await getBlockedUserIds(session.user.id);
  if (blockedIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: blockedIds } },
    select: {
      id: true,
      username: true,
      displayName: true,
      name: true,
      avatar: true,
      image: true,
      profileFrameId: true,
      usernameFont: true,
      phoneVerified: true,
    },
    orderBy: { username: "asc" },
  });

  return JSON.parse(JSON.stringify(users));
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
 * Build the relationship-cleanup operations for blocking a single user.
 * Returns an array of Prisma operations to include in a transaction.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildBlockOps(blockerId: string, targetId: string): any[] {
  return [
    prisma.block.create({
      data: { blockerId, blockedId: targetId },
    }),
    prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: blockerId, followingId: targetId },
          { followerId: targetId, followingId: blockerId },
        ],
      },
    }),
    prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: blockerId, receiverId: targetId },
          { senderId: targetId, receiverId: blockerId },
        ],
      },
    }),
    prisma.postSubscription.deleteMany({
      where: {
        OR: [
          { subscriberId: blockerId, subscribedToId: targetId },
          { subscriberId: targetId, subscribedToId: blockerId },
        ],
      },
    }),
    prisma.closeFriend.deleteMany({
      where: {
        OR: [
          { userId: blockerId, friendId: targetId },
          { userId: targetId, friendId: blockerId },
        ],
      },
    }),
  ];
}

/**
 * Toggle block on a user. When blocking, also removes mutual follows,
 * friend requests, post subscriptions, and close friend entries.
 * Optionally blocks all accounts sharing the target's verified phone number.
 */
export async function toggleBlock(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("block");
  if (isActionError(result)) return result;
  const session = result;

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
    const ops = buildBlockOps(session.user.id, targetUserId);

    if (blockByPhone) {
      // Look up target's verified phone number
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { phoneNumber: true, phoneVerified: true },
      });

      if (targetUser?.phoneNumber && targetUser.phoneVerified) {
        // Create PhoneBlock record for future enforcement
        ops.push(
          prisma.phoneBlock.upsert({
            where: {
              blockerId_phoneNumber: {
                blockerId: session.user.id,
                phoneNumber: targetUser.phoneNumber,
              },
            },
            create: {
              blockerId: session.user.id,
              phoneNumber: targetUser.phoneNumber,
            },
            update: {},
          })
        );

        // Find all other accounts with the same verified phone number
        const otherAccounts = await prisma.user.findMany({
          where: {
            phoneNumber: targetUser.phoneNumber,
            phoneVerified: { not: null },
            id: { notIn: [session.user.id, targetUserId] },
          },
          select: { id: true },
        });

        // Block each of them too (skip if already blocked)
        for (const account of otherAccounts) {
          const alreadyBlocked = await prisma.block.findUnique({
            where: {
              blockerId_blockedId: {
                blockerId: session.user.id,
                blockedId: account.id,
              },
            },
          });
          if (!alreadyBlocked) {
            ops.push(...buildBlockOps(session.user.id, account.id));
          }
        }
      }
    }

    await prisma.$transaction(ops);
  }

  // Instantly invalidate all block + relationship caches for both users
  try {
    const [currentUserData, targetUserData] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.user.id }, select: { username: true } }),
      prisma.user.findUnique({ where: { id: targetUserId }, select: { username: true } }),
    ]);

    await Promise.all([
      // Block caches — instant invalidation for both users
      invalidateBlockCaches(session.user.id),
      invalidateBlockCaches(targetUserId),
      // Follow caches
      invalidate(cacheKeys.userFollowing(session.user.id)),
      invalidate(cacheKeys.userFollowing(targetUserId)),
      // Close friend caches (block also removes close friends)
      invalidate(cacheKeys.userCloseFriendIds(session.user.id)),
      invalidate(cacheKeys.userCloseFriendIds(targetUserId)),
      invalidate(cacheKeys.userCloseFriendOf(session.user.id)),
      invalidate(cacheKeys.userCloseFriendOf(targetUserId)),
      // Friendship cache
      invalidate(cacheKeys.friendshipStatus(session.user.id, targetUserId)),
      // Profile caches
      ...(currentUserData?.username ? [invalidate(cacheKeys.userProfile(currentUserData.username))] : []),
      ...(targetUserData?.username ? [invalidate(cacheKeys.userProfile(targetUserData.username))] : []),
    ]);
  } catch {
    // Non-critical
  }

  revalidatePath("/");
  return { success: true, message: existing ? "Unblocked" : "Blocked" };
}
