import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { calculateAge } from "@/lib/age-gate";
import { getCloseFriends, getCloseFriendIds, getAcceptedFriends } from "@/app/feed/close-friends-actions";
import { getPostInclude, getRepostInclude, PAGE_SIZE } from "@/app/feed/feed-queries";
import { CloseFriendsPageClient } from "./close-friends-page-client";
import { isProfileIncomplete } from "@/lib/require-profile";

export default async function CloseFriendsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [currentUser, closeFriends, closeFriendIds, allFriends] = await Promise.all([
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
      },
    }),
    getCloseFriends(),
    getCloseFriendIds(userId),
    getAcceptedFriends(),
  ]);

  if (isProfileIncomplete(currentUser)) redirect("/complete-profile");

  const phoneVerified = !!currentUser.phoneVerified;
  const ageVerified = !!currentUser.ageVerified;
  const showGraphicByDefault = currentUser.showGraphicByDefault ?? false;
  const showNsfwContent = currentUser.showNsfwContent ?? false;
  const isOldEnough = currentUser.dateOfBirth ? calculateAge(currentUser.dateOfBirth) >= 18 : false;

  const closeFriendIdSet = new Set(closeFriendIds);
  const availableFriends = allFriends.filter((f) => !closeFriendIdSet.has(f.id));

  // Fetch posts from close friends (all their posts, not just close-friends-only)
  const fetchCount = PAGE_SIZE + 1;
  const postInclude = getPostInclude(userId);

  const [posts, reposts] = closeFriendIds.length > 0
    ? await Promise.all([
        prisma.post.findMany({
          where: {
            authorId: { in: closeFriendIds },
            ...(!showNsfwContent ? { isNsfw: false } : {}),
            ...(!ageVerified ? { isSensitive: false, isGraphicNudity: false } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: fetchCount,
          include: postInclude,
        }),
        prisma.repost.findMany({
          where: {
            userId: { in: closeFriendIds },
          },
          orderBy: { createdAt: "desc" },
          take: fetchCount,
          include: getRepostInclude(userId),
        }),
      ])
    : [[], []];

  // Deduplicate: skip simple reposts when the original post is already in the feed.
  // Quote reposts (those with content) are always kept since they have unique content.
  const directPostIds = new Set(posts.map((p) => p.id));
  const filteredReposts = reposts.filter((r) => r.content != null || !directPostIds.has(r.post.id));

  const allItems = [
    ...posts.map((p) => ({
      type: "post" as const,
      data: JSON.parse(JSON.stringify(p)),
      date: p.createdAt.toISOString(),
    })),
    ...filteredReposts.map((r) => ({
      type: "repost" as const,
      data: JSON.parse(JSON.stringify(r)),
      date: r.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const hasMore = allItems.length > PAGE_SIZE;
  const initialItems = allItems.slice(0, PAGE_SIZE);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <CloseFriendsPageClient
        initialItems={initialItems}
        initialHasMore={hasMore}
        currentUserId={userId}
        phoneVerified={phoneVerified}
        ageVerified={ageVerified}
        showGraphicByDefault={showGraphicByDefault}
        showNsfwContent={showNsfwContent}
        closeFriends={JSON.parse(JSON.stringify(closeFriends))}
        availableFriends={JSON.parse(JSON.stringify(availableFriends))}
      />
    </main>
  );
}
