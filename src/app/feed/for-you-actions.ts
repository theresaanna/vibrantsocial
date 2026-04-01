"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPostInclude, PAGE_SIZE } from "./feed-queries";
import { cached, cacheKeys } from "@/lib/cache";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";
import { getUserPrefs } from "@/lib/user-prefs";

export async function fetchForYouPage(cursor?: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { items: [] as any[], hasMore: false };
  }

  const userId = session.user.id;

  const [allFollowingIds, blockedIds, prefs] = await Promise.all([
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
    getUserPrefs(userId),
  ]);

  const { showNsfwContent, ageVerified } = prefs;
  const excludeIds = [...allFollowingIds, userId, ...blockedIds];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const postInclude = getPostInclude(userId);
  const dateFilter = cursor ? { lt: new Date(cursor), gte: sevenDaysAgo } : { gte: sevenDaysAgo };
  const fetchCount = PAGE_SIZE + 1;

  // Fetch a larger pool to sample randomly from
  const pool = await prisma.post.findMany({
    where: {
      authorId: { notIn: excludeIds },
      createdAt: dateFilter,
      isCloseFriendsOnly: false,
      hasCustomAudience: false,
      isLoggedInOnly: false,
      ...(!showNsfwContent ? { isNsfw: false } : {}),
      ...(!ageVerified ? { isSensitive: false, isGraphicNudity: false } : {}),
      OR: [
        { marketplacePost: null },
        { marketplacePost: { promotedToFeed: true } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: fetchCount * 5,
    include: postInclude,
  });

  // Shuffle and take fetchCount items
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const selected = pool.slice(0, fetchCount);

  const items = selected.map((p: { createdAt: Date }) => ({
    type: "post" as const,
    data: JSON.parse(JSON.stringify(p)),
    date: p.createdAt.toISOString(),
  }));

  const hasMore = items.length > PAGE_SIZE;

  return {
    items: hasMore ? items.slice(0, PAGE_SIZE) : items,
    hasMore,
  };
}
