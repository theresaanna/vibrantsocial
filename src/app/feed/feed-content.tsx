import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { FeedClient } from "@/components/feed-client";
import { calculateAge } from "@/lib/age-gate";
import { getPostInclude, repostUserSelect, PAGE_SIZE } from "./feed-queries";
import { cached, cacheKeys } from "@/lib/cache";

/**
 * Async server component that fetches all feed data.
 * Designed to be wrapped in <Suspense> so the page shell streams immediately.
 */
export async function FeedContent({ userId }: { userId: string }) {
  // Phase 1: currentUser + cached followingIds in parallel
  const [currentUser, followingIds] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        phoneVerified: true,
        dateOfBirth: true,
        biometricVerified: true,
        showGraphicByDefault: true,
        showNsfwContent: true,
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
  ]);

  if (!currentUser?.dateOfBirth) redirect("/complete-profile");

  const phoneVerified = !!currentUser.phoneVerified;
  const biometricVerified = !!currentUser.biometricVerified;
  const showGraphicByDefault = currentUser.showGraphicByDefault ?? false;
  const showNsfwContent = currentUser.showNsfwContent ?? false;
  const isOldEnough = currentUser.dateOfBirth
    ? calculateAge(currentUser.dateOfBirth) >= 18
    : false;

  const postInclude = getPostInclude(userId);
  const fetchCount = PAGE_SIZE + 1;

  // Phase 2: posts + reposts in parallel
  const [posts, reposts] = await Promise.all([
    prisma.post.findMany({
      where: {
        authorId: { in: [...followingIds, userId] },
        ...(!showNsfwContent ? { isNsfw: false } : {}),
        ...(!biometricVerified ? { isSensitive: false, isGraphicNudity: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: fetchCount,
      include: postInclude,
    }),
    prisma.repost.findMany({
      where: {
        userId: { in: followingIds },
      },
      orderBy: { createdAt: "desc" },
      take: fetchCount,
      include: {
        user: { select: repostUserSelect },
        post: { include: postInclude },
      },
    }),
  ]);

  // Deduplicate: if a post appears both directly and via repost, keep the direct post
  const directPostIds = new Set(posts.map((p: { id: string }) => p.id));
  const filteredReposts = reposts.filter(
    (r: { post: { id: string } }) => !directPostIds.has(r.post.id)
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

  return (
    <FeedClient
      phoneVerified={phoneVerified}
      isOldEnough={isOldEnough}
      initialItems={initialItems}
      initialHasMore={hasMore}
      currentUserId={userId}
      biometricVerified={biometricVerified}
      showGraphicByDefault={showGraphicByDefault}
      showNsfwContent={showNsfwContent}
      hasEmail={!!currentUser.email}
    />
  );
}
