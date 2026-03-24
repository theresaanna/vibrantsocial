import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { FeedClient } from "@/components/feed-client";
import { calculateAge } from "@/lib/age-gate";
import { getPostInclude, getRepostInclude, PAGE_SIZE } from "./feed-queries";
import { cached, cacheKeys } from "@/lib/cache";
import { getCloseFriendIds } from "@/app/feed/close-friends-actions";
import { isProfileIncomplete } from "@/lib/require-profile";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";

/**
 * Async server component that fetches all feed data.
 * Designed to be wrapped in <Suspense> so the page shell streams immediately.
 */
export async function FeedContent({ userId }: { userId: string }) {
  // Phase 1: currentUser + cached followingIds + closeFriendOf + blockedIds in parallel
  const [currentUser, allFollowingIds, closeFriendOfIds, blockedIds] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        email: true,
        phoneVerified: true,
        dateOfBirth: true,
        ageVerified: true,
        showGraphicByDefault: true,
        showNsfwContent: true,
        tier: true,
        lastSeenFeedAt: true,
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
      60 // cache for 60 seconds
    ),
    // Fetch IDs of users who have added the current user as a close friend
    prisma.closeFriend.findMany({
      where: { friendId: userId },
      select: { userId: true },
    }).then((rows) => rows.map((r) => r.userId)),
    getAllBlockRelatedIds(userId),
  ]);

  const blockedSet = new Set(blockedIds);
  const followingIds = allFollowingIds.filter((id: string) => !blockedSet.has(id));

  if (!currentUser || isProfileIncomplete(currentUser)) redirect("/complete-profile");

  const phoneVerified = !!currentUser.phoneVerified;
  const ageVerified = !!currentUser.ageVerified;
  const showGraphicByDefault = currentUser.showGraphicByDefault ?? false;
  const showNsfwContent = currentUser.showNsfwContent ?? false;
  const isOldEnough = currentUser.dateOfBirth
    ? calculateAge(currentUser.dateOfBirth) >= 18
    : false;

  const postInclude = getPostInclude(userId);
  const fetchCount = PAGE_SIZE + 1;

  // Authors whose close-friends-only posts the current user can see
  const closeFriendAuthors = [...closeFriendOfIds, userId];

  // Phase 2: posts + reposts in parallel
  const [posts, reposts] = await Promise.all([
    prisma.post.findMany({
      where: {
        authorId: { in: [...followingIds, userId] },
        ...(!showNsfwContent ? { isNsfw: false } : {}),
        ...(!ageVerified ? { isSensitive: false, isGraphicNudity: false } : {}),
        OR: [
          { isCloseFriendsOnly: false, hasCustomAudience: false },
          { isCloseFriendsOnly: true, authorId: { in: closeFriendAuthors } },
          { hasCustomAudience: true, audience: { some: { userId } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: fetchCount,
      include: postInclude,
    }),
    prisma.repost.findMany({
      where: {
        userId: { in: [...followingIds, userId] },
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

  // Deduplicate: if a post appears both directly and via simple repost, keep the direct post.
  // Quote reposts (those with content) are always kept since they have unique content.
  const directPostIds = new Set(posts.map((p: { id: string }) => p.id));
  const filteredReposts = reposts.filter(
    (r: { content?: string | null; post: { id: string } }) =>
      r.content != null || !directPostIds.has(r.post.id)
  );

  // Merge and sort chronologically, serialize for client component
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
  const initialItems = allItems.slice(0, PAGE_SIZE);

  const lastSeenFeedAt = currentUser.lastSeenFeedAt?.toISOString() ?? null;

  // Fire-and-forget: update lastSeenFeedAt for next visit
  prisma.user
    .update({
      where: { id: userId },
      data: { lastSeenFeedAt: new Date() },
    })
    .catch(() => {});

  return (
    <FeedClient
      phoneVerified={phoneVerified}
      isOldEnough={isOldEnough}
      initialItems={initialItems}
      initialHasMore={hasMore}
      currentUserId={userId}
      ageVerified={ageVerified}
      showGraphicByDefault={showGraphicByDefault}
      showNsfwContent={showNsfwContent}
      hasEmail={!!currentUser.email}
      isPremium={currentUser.tier === "premium"}
      lastSeenFeedAt={lastSeenFeedAt}
    />
  );
}
