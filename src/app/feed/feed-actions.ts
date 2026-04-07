"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPostInclude, getRepostInclude, PAGE_SIZE, publishedOnly } from "./feed-queries";
import { cached, cacheKeys } from "@/lib/cache";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";
import { getUserPrefs } from "@/lib/user-prefs";
import { getCachedCloseFriendOfIds } from "@/app/feed/close-friends-actions";

export async function fetchSinglePost(postId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: getPostInclude(session.user.id),
  });
  if (!post || post.scheduledFor) return null;

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

  // Fetch user preferences and close-friend-of data in parallel (both cached)
  const [prefs, closeFriendOfIds] = await Promise.all([
    getUserPrefs(userId),
    getCachedCloseFriendOfIds(userId),
  ]);
  const { showNsfwContent, ageVerified, hideWallFromFeed } = prefs;
  const closeFriendAuthors = [...closeFriendOfIds, userId];

  const postInclude = getPostInclude(userId);
  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;
  const fetchCount = PAGE_SIZE + 1;

  // Run posts + reposts + wall posts queries in parallel
  const [posts, reposts, wallPosts] = await Promise.all([
    prisma.post.findMany({
      where: {
        ...publishedOnly,
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
    // Fetch accepted wall posts on the current user's wall (unless they prefer a separate tab)
    !hideWallFromFeed
      ? prisma.wallPost.findMany({
          where: {
            wallOwnerId: userId,
            status: "accepted",
            ...(dateFilter ? { createdAt: dateFilter } : {}),
            post: {
              authorId: { notIn: blockedIds },
              ...(!showNsfwContent ? { isNsfw: false } : {}),
              ...(!ageVerified ? { isSensitive: false, isGraphicNudity: false } : {}),
            },
          },
          orderBy: { createdAt: "desc" },
          take: fetchCount,
          include: {
            post: { include: postInclude },
            wallOwner: {
              select: { username: true, displayName: true, usernameFont: true },
            },
          },
        })
      : [],
  ]);

  // Deduplicate: skip simple reposts when the original post is already in the feed.
  // Quote reposts (those with content) are always kept since they have unique content.
  const directPostIds = new Set(posts.map((p: { id: string }) => p.id));
  const filteredReposts = reposts.filter(
    (r: { content?: string | null; post: { id: string } }) =>
      r.content != null || !directPostIds.has(r.post.id)
  );

  // Deduplicate wall posts: skip if the underlying post already appears via following the author
  const filteredWallPosts = wallPosts.filter(
    (wp: { postId: string }) => !directPostIds.has(wp.postId)
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
    ...filteredWallPosts.map((wp: { post: { id: string }; createdAt: Date }) => ({
      type: "post" as const,
      data: JSON.parse(JSON.stringify(wp.post)),
      date: wp.createdAt.toISOString(),
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

  const [prefs2, closeFriendOfIds2] = await Promise.all([
    getUserPrefs(userId),
    getCachedCloseFriendOfIds(userId),
  ]);
  const { showNsfwContent, ageVerified, hideWallFromFeed } = prefs2;
  const closeFriendAuthors = [...closeFriendOfIds2, userId];

  const postInclude = getPostInclude(userId);
  const since = new Date(sinceDate);

  const [posts, reposts, wallPosts] = await Promise.all([
    prisma.post.findMany({
      where: {
        ...publishedOnly,
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
    !hideWallFromFeed
      ? prisma.wallPost.findMany({
          where: {
            wallOwnerId: userId,
            status: "accepted",
            createdAt: { gt: since },
            post: {
              authorId: { notIn: blockedIds },
              ...(!showNsfwContent ? { isNsfw: false } : {}),
              ...(!ageVerified ? { isSensitive: false, isGraphicNudity: false } : {}),
            },
          },
          orderBy: { createdAt: "desc" },
          take: PAGE_SIZE,
          include: {
            post: { include: postInclude },
            wallOwner: {
              select: { username: true, displayName: true, usernameFont: true },
            },
          },
        })
      : [],
  ]);

  const directPostIds = new Set(posts.map((p: { id: string }) => p.id));
  const filteredReposts = reposts.filter(
    (r: { content?: string | null; post: { id: string } }) =>
      r.content != null || !directPostIds.has(r.post.id)
  );
  const filteredWallPosts = wallPosts.filter(
    (wp: { postId: string }) => !directPostIds.has(wp.postId)
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
    ...filteredWallPosts.map((wp: { post: { id: string }; createdAt: Date }) => ({
      type: "post" as const,
      data: JSON.parse(JSON.stringify(wp.post)),
      date: wp.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
