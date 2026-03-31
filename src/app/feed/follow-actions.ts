"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { invalidate, cacheKeys } from "@/lib/cache";
import {
  requireAuthWithRateLimit,
  isActionError,
  hasBlock,
  createNotificationSafe,
  USER_PROFILE_SELECT,
} from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";

export interface FollowUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  profileFrameId: string | null;
  usernameFont: string | null;
  isFollowing: boolean;
}

export async function getFollowers(username: string): Promise<FollowUser[]> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!user) return [];

  const session = await auth();
  const currentUserId = session?.user?.id;

  const follows = await prisma.follow.findMany({
    where: { followingId: user.id },
    include: { follower: { select: USER_PROFILE_SELECT } },
    orderBy: { createdAt: "desc" },
  });

  let currentUserFollowingIds = new Set<string>();
  if (currentUserId) {
    const myFollows = await prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });
    currentUserFollowingIds = new Set(myFollows.map((f: { followingId: string }) => f.followingId));
  }

  return follows.map((f: { follower: Omit<FollowUser, "isFollowing"> }) => ({
    ...f.follower,
    isFollowing: currentUserFollowingIds.has(f.follower.id),
  }));
}

export async function getFollowing(username: string): Promise<FollowUser[]> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!user) return [];

  const session = await auth();
  const currentUserId = session?.user?.id;

  const follows = await prisma.follow.findMany({
    where: { followerId: user.id },
    include: { following: { select: USER_PROFILE_SELECT } },
    orderBy: { createdAt: "desc" },
  });

  let currentUserFollowingIds = new Set<string>();
  if (currentUserId) {
    const myFollows = await prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });
    currentUserFollowingIds = new Set(myFollows.map((f: { followingId: string }) => f.followingId));
  }

  return follows.map((f: { following: Omit<FollowUser, "isFollowing"> }) => ({
    ...f.following,
    isFollowing: currentUserFollowingIds.has(f.following.id),
  }));
}

export async function toggleFollow(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("follow");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const targetUserId = formData.get("userId") as string;

  if (targetUserId === session.user.id) {
    return { success: false, message: "Cannot follow yourself" };
  }

  if (await hasBlock(session.user.id, targetUserId)) {
    return { success: false, message: "Cannot follow this user" };
  }

  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: session.user.id,
        followingId: targetUserId,
      },
    },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
  } else {
    await prisma.follow.create({
      data: { followerId: session.user.id, followingId: targetUserId },
    });

    await createNotificationSafe({
      type: "FOLLOW",
      actorId: session.user.id,
      targetUserId,
    });
  }

  const [currentUserData, targetUserData] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { username: true } }),
    prisma.user.findUnique({ where: { id: targetUserId }, select: { username: true } }),
  ]);

  const invalidations = [invalidate(cacheKeys.userFollowing(session.user.id))];
  if (currentUserData?.username) {
    invalidations.push(invalidate(cacheKeys.userProfile(currentUserData.username)));
  }
  if (targetUserData?.username) {
    invalidations.push(invalidate(cacheKeys.userProfile(targetUserData.username)));
  }
  await Promise.all(invalidations);

  revalidatePath("/feed");
  return { success: true, message: existing ? "Unfollowed" : "Followed" };
}
