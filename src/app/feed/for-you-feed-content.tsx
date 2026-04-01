import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { FeedClient } from "@/components/feed-client";
import { calculateAge } from "@/lib/age-gate";
import { getPostInclude, PAGE_SIZE } from "./feed-queries";
import { cached, cacheKeys } from "@/lib/cache";
import { isProfileIncomplete } from "@/lib/require-profile";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";
import { fetchForYouPage } from "./for-you-actions";

export async function ForYouFeedContent({ userId }: { userId: string }) {
  const [currentUser, allFollowingIds, blockedIds] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        email: true,
        phoneVerified: true,
        dateOfBirth: true,
        ageVerified: true,
        showGraphicByDefault: true,
        hideSensitiveOverlay: true,
        showNsfwContent: true,
        tier: true,
      },
    }),
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

  if (!currentUser || isProfileIncomplete(currentUser)) redirect("/complete-profile");

  const phoneVerified = !!currentUser.phoneVerified;
  const ageVerified = !!currentUser.ageVerified;
  const showGraphicByDefault = currentUser.showGraphicByDefault ?? false;
  const hideSensitiveOverlay = currentUser.hideSensitiveOverlay ?? false;
  const showNsfwContent = currentUser.showNsfwContent ?? false;
  const isOldEnough = currentUser.dateOfBirth
    ? calculateAge(currentUser.dateOfBirth) >= 18
    : false;

  const excludeIds = [...allFollowingIds, userId, ...blockedIds];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const postInclude = getPostInclude(userId);
  const fetchCount = PAGE_SIZE + 1;

  // Fetch a larger pool and randomly sample
  const pool = await prisma.post.findMany({
    where: {
      authorId: { notIn: excludeIds },
      createdAt: { gte: sevenDaysAgo },
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

  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const selected = pool.slice(0, fetchCount);

  const allItems = selected.map((p: { createdAt: Date }) => ({
    type: "post" as const,
    data: JSON.parse(JSON.stringify(p)),
    date: p.createdAt.toISOString(),
  }));

  const hasMore = allItems.length > PAGE_SIZE;
  const initialItems = allItems.slice(0, PAGE_SIZE);

  return (
    <FeedClient
      phoneVerified={phoneVerified}
      isOldEnough={isOldEnough}
      initialItems={initialItems}
      initialHasMore={hasMore}
      currentUserId={userId}
      ageVerified={ageVerified}
      showGraphicByDefault={showGraphicByDefault}
      hideSensitiveOverlay={hideSensitiveOverlay}
      showNsfwContent={showNsfwContent}
      hasEmail={!!currentUser.email}
      isPremium={currentUser.tier === "premium"}
      listId="for-you"
      activeView="posts"
      fetchPage={fetchForYouPage}
    />
  );
}
