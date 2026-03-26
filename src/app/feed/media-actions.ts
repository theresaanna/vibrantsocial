"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractMediaFromLexicalJson } from "@/lib/lexical-text";
import { cached, cacheKeys } from "@/lib/cache";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";

const MEDIA_PAGE_SIZE = 30;

interface MediaPost {
  id: string;
  slug: string | null;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    image: string | null;
    avatar: string | null;
    profileFrameId: string | null;
    usernameFont: string | null;
  } | null;
}

/**
 * Fetch feed posts that contain media (images, videos, YouTube embeds).
 * We fetch more posts than MEDIA_PAGE_SIZE to account for posts without media,
 * then filter to only those with media content.
 */
export async function fetchMediaFeedPage(
  cursor?: string
): Promise<{ posts: MediaPost[]; hasMore: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { posts: [], hasMore: false };
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
  const followingIds = allFollowingIds.filter(
    (id: string) => !blockedSet.has(id)
  );

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
  const closeFriendAuthors = [
    ...closeFriendOfRows.map((r: { userId: string }) => r.userId),
    userId,
  ];

  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;

  // Fetch more posts than needed since many won't have media
  const fetchCount = MEDIA_PAGE_SIZE * 3;

  const posts = await prisma.post.findMany({
    where: {
      authorId: { in: [...followingIds, userId] },
      ...(dateFilter ? { createdAt: dateFilter } : {}),
      ...(!showNsfwContent ? { isNsfw: false } : {}),
      ...(!ageVerified ? { isSensitive: false, isGraphicNudity: false } : {}),
      // Exclude marketplace posts unless promoted to feed
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
    select: {
      id: true,
      slug: true,
      content: true,
      createdAt: true,
      author: {
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
    },
  });

  // Filter to posts that contain media
  const mediaPosts: MediaPost[] = [];
  for (const post of posts) {
    const media = extractMediaFromLexicalJson(post.content);
    if (media.length > 0) {
      mediaPosts.push({
        id: post.id,
        slug: post.slug,
        content: post.content,
        createdAt: post.createdAt.toISOString(),
        author: post.author,
      });
    }
    if (mediaPosts.length >= MEDIA_PAGE_SIZE + 1) break;
  }

  const hasMore = mediaPosts.length > MEDIA_PAGE_SIZE;
  return {
    posts: mediaPosts.slice(0, MEDIA_PAGE_SIZE),
    hasMore,
  };
}
