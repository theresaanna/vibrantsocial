"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { invalidate, cacheKeys } from "@/lib/cache";

export interface FollowUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  isFollowing: boolean;
}

const userSelect = {
  id: true,
  username: true,
  displayName: true,
  name: true,
  avatar: true,
  image: true,
} as const;

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
    include: { follower: { select: userSelect } },
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
    include: { following: { select: userSelect } },
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

interface FollowState {
  success: boolean;
  message: string;
}

export async function toggleFollow(
  _prevState: FollowState,
  formData: FormData
): Promise<FollowState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const targetUserId = formData.get("userId") as string;

  if (targetUserId === session.user.id) {
    return { success: false, message: "Cannot follow yourself" };
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
    // Remove both directions of the friendship
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: session.user.id, followingId: targetUserId },
          { followerId: targetUserId, followingId: session.user.id },
        ],
      },
    });
  } else {
    // Create mutual follows (friendship)
    await prisma.$transaction([
      prisma.follow.create({
        data: { followerId: session.user.id, followingId: targetUserId },
      }),
      prisma.follow.create({
        data: { followerId: targetUserId, followingId: session.user.id },
      }),
    ]);
  }

  // Invalidate caches for both users
  const [currentUserData, targetUserData] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { username: true } }),
    prisma.user.findUnique({ where: { id: targetUserId }, select: { username: true } }),
  ]);

  const invalidations = [
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

  revalidatePath("/feed");
  return { success: true, message: existing ? "Removed friend" : "Added friend" };
}
