"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPostInclude, getRepostInclude, PAGE_SIZE } from "./feed-queries";
import { cached, cacheKeys } from "@/lib/cache";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";

export async function fetchSinglePost(postId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: getPostInclude(session.user.id),
  });
  if (!post) return null;

  return {
    type: "post" as const,
    data: JSON.parse(JSON.stringify(post)),
    date: post.createdAt.toISOString(),
  };
}

export async function fetchFeedPage(cursor?: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { items: [] as any[], hasMore: false };
  }

  const userId = session.user.id;

  const [allFollowingIds, blockedIds] = await Promise.all([
    cached(
      cacheKeys.userFollowing(userId),
      async () => {
        const rows = await prisma.follow.findMany({
          where: { followerId: userId },
          select: { followingId: true },
        });
        return rows.map((f: { followingId: string }) => f.followingId);
      },
      60 // cache for 60 seconds
    ),
    getAllBlockRelatedIds(userId),
  ]);

  const blockedSet = new Set(blockedIds);
  const followingIds = allFollowingIds.filter((id: string) => !blockedSet.has(id));

  // Fetch user preferences and close-friend-of data in parallel
  const [currentUser, closeFriendOfRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { showNsfwContent: true, ageVerified: true },
    }),
    prisma.closeFriend.findMany({
      where: { friendId: userId },
      select: { userId: true },
    }),
  ]);
  const showNsfwContent = currentUser?.showNsfwContent ?? false;
  const ageVerified = !!currentUser?.ageVerified;
  const closeFriendAuthors = [...closeFriendOfRows.map((r: { userId: string }) => r.userId), userId];

  const postInclude = getPostInclude(userId);
  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;
  const fetchCount = PAGE_SIZE + 1;

  // Run posts + reposts queries in parallel
  const [posts, reposts] = await Promise.all([
    prisma.post.findMany({
      where: {
        authorId: { in: [...followingIds, userId] },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        ...(!showNsfwContent ? { isNsfw: false } : {}),
        ...(!ageVerified ? { isSensitive: false, isGraphicNudity: false } : {}),
        OR: [
          { marketplacePost: null },
          { marketplacePost: { promotedToFeed: true } },
        ],
        AND: [
          {
            OR: [
              { isCloseFriendsOnly: false, hasCustomAudience: false },
              { isCloseFriendsOnly: true, authorId: { in: closeFriendAuthors } },
              { hasCustomAudience: true, audience: { some: { userId } } },
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: fetchCount,
      include: postInclude,
    }),
    prisma.repost.findMany({
      where: {
        userId: { in: [...followingIds, userId] },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        OR: [
          { isCloseFriendsOnly: false },
          { isCloseFriendsOnly: true, userId: { in: closeFriendAuthors } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: fetchCount,
      include: getRepostInclude(userId),
    }),
  ]);

  // Deduplicate: skip simple reposts when the original post is already in the feed.
  // Quote reposts (those with content) are always kept since they have unique content.
  const directPostIds = new Set(posts.map((p: { id: string }) => p.id));
  const filteredReposts = reposts.filter(
    (r: { content?: string | null; post: { id: string } }) =>
      r.content != null || !directPostIds.has(r.post.id)
  );

  const allItems = [
    ...posts.map((p: { createdAt: Date }) => ({
      type: "post" as const,
      data: JSON.parse(JSON.stringify(p)),
      date: p.createdAt.toISOString(),
    })),
    ...filteredReposts.map((r: { createdAt: Date }) => ({
      type: "repost" as const,
      data: JSON.parse(JSON.stringify(r)),
      date: r.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const hasMore = allItems.length > PAGE_SIZE;
  const items = allItems.slice(0, PAGE_SIZE);

  return { items, hasMore };
}

/**
 * Fetch feed items newer than the given date.
 * Used for polling to pick up new posts without a page reload.
 */
export async function fetchNewFeedItems(sinceDate: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  const userId = session.user.id;

  const [allFollowingIds, blockedIds] = await Promise.all([
    cached(
      cacheKeys.userFollowing(userId),
      async () => {
        const rows = await prisma.follow.findMany({
          where: { followerId: userId },
          select: { followingId: true },
        });
        return rows.map((f: { followingId: string }) => f.followingId);
      },
      60
    ),
    getAllBlockRelatedIds(userId),
  ]);

  const blockedSet = new Set(blockedIds);
  const followingIds = allFollowingIds.filter((id: string) => !blockedSet.has(id));

  const [currentUser, closeFriendOfRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { showNsfwContent: true, ageVerified: true },
    }),
    prisma.closeFriend.findMany({
      where: { friendId: userId },
      select: { userId: true },
    }),
  ]);
  const showNsfwContent = currentUser?.showNsfwContent ?? false;
  const ageVerified = !!currentUser?.ageVerified;
  const closeFriendAuthors = [...closeFriendOfRows.map((r: { userId: string }) => r.userId), userId];

  const postInclude = getPostInclude(userId);
  const since = new Date(sinceDate);

  const [posts, reposts] = await Promise.all([
    prisma.post.findMany({
      where: {
        authorId: { in: [...followingIds, userId] },
        createdAt: { gt: since },
        ...(!showNsfwContent ? { isNsfw: false } : {}),
        ...(!ageVerified ? { isSensitive: false, isGraphicNudity: false } : {}),
        OR: [
          { marketplacePost: null },
          { marketplacePost: { promotedToFeed: true } },
        ],
        AND: [
          {
            OR: [
              { isCloseFriendsOnly: false, hasCustomAudience: false },
              { isCloseFriendsOnly: true, authorId: { in: closeFriendAuthors } },
              { hasCustomAudience: true, audience: { some: { userId } } },
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: postInclude,
    }),
    prisma.repost.findMany({
      where: {
        userId: { in: [...followingIds, userId] },
        createdAt: { gt: since },
        OR: [
          { isCloseFriendsOnly: false },
          { isCloseFriendsOnly: true, userId: { in: closeFriendAuthors } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: getRepostInclude(userId),
    }),
  ]);

  const directPostIds = new Set(posts.map((p: { id: string }) => p.id));
  const filteredReposts = reposts.filter(
    (r: { content?: string | null; post: { id: string } }) =>
      r.content != null || !directPostIds.has(r.post.id)
  );

  return [
    ...posts.map((p: { createdAt: Date }) => ({
      type: "post" as const,
      data: JSON.parse(JSON.stringify(p)),
      date: p.createdAt.toISOString(),
    })),
    ...filteredReposts.map((r: { createdAt: Date }) => ({
      type: "repost" as const,
      data: JSON.parse(JSON.stringify(r)),
      date: r.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
