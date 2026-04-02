"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cached, cacheKeys } from "@/lib/cache";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";
import { getUserPrefs } from "@/lib/user-prefs";
import { getCachedCloseFriendOfIds } from "@/app/feed/close-friends-actions";

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

  const [prefs, closeFriendOfIds] = await Promise.all([
    getUserPrefs(userId),
    getCachedCloseFriendOfIds(userId),
  ]);

  const { showNsfwContent, ageVerified, hideSensitiveOverlay, showGraphicByDefault } = prefs;
  const closeFriendAuthors = [...closeFriendOfIds, userId];

  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;

  const posts = await prisma.post.findMany({
    where: {
      authorId: { in: [...followingIds, userId] },
      ...(dateFilter ? { createdAt: dateFilter } : {}),
      ...(!showNsfwContent ? { isNsfw: false } : {}),
      ...(!ageVerified || !hideSensitiveOverlay ? { isSensitive: false } : {}),
      ...(!ageVerified || !showGraphicByDefault ? { isGraphicNudity: false } : {}),
      // Only fetch posts that contain media nodes in their Lexical JSON content
      OR: [
        { content: { contains: '"type":"image"' } },
        { content: { contains: '"type":"video"' } },
        { content: { contains: '"type":"youtube"' } },
      ],
      AND: [
        {
          // Exclude marketplace posts unless promoted to feed
          OR: [
            { marketplacePost: null },
            { marketplacePost: { promotedToFeed: true } },
          ],
        },
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
    take: MEDIA_PAGE_SIZE + 1,
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

  const hasMore = posts.length > MEDIA_PAGE_SIZE;
  const mediaPosts: MediaPost[] = posts.slice(0, MEDIA_PAGE_SIZE).map((post) => ({
    id: post.id,
    slug: post.slug,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: post.author,
  }));

  return { posts: mediaPosts, hasMore };
}
