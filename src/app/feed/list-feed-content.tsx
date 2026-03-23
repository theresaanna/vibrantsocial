import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { FeedClient } from "@/components/feed-client";
import { calculateAge } from "@/lib/age-gate";
import { getPostInclude, getRepostInclude, PAGE_SIZE } from "./feed-queries";
import { cached, cacheKeys } from "@/lib/cache";
import { getCloseFriendIds } from "@/app/feed/close-friends-actions";
import { isProfileIncomplete } from "@/lib/require-profile";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";

interface ListSummary {
  id: string;
  name: string;
}

export async function ListFeedContent({ userId, listId, lists }: { userId: string; listId: string; lists: ListSummary[] }) {
  // Verify the list exists
  const list = await prisma.userList.findUnique({
    where: { id: listId },
    select: { id: true, name: true },
  });
  if (!list) redirect("/feed");

  // Phase 1: currentUser + list member IDs + closeFriendOf + blockedIds in parallel
  const [currentUser, memberRows, closeFriendOfIds, blockedIds] = await Promise.all([
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
      },
    }),
    cached(
      cacheKeys.userListMembers(listId) + ":ids",
      async () => {
        const rows = await prisma.userListMember.findMany({
          where: { listId },
          select: { userId: true },
        });
        return rows.map((m: { userId: string }) => m.userId);
      },
      60
    ),
    prisma.closeFriend.findMany({
      where: { friendId: userId },
      select: { userId: true },
    }).then((rows) => rows.map((r) => r.userId)),
    getAllBlockRelatedIds(userId),
  ]);

  const blockedSet = new Set(blockedIds);
  const memberIds = memberRows.filter((id: string) => !blockedSet.has(id));

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
  const closeFriendAuthors = [...closeFriendOfIds, userId];

  // If the list has no members, return empty feed
  if (memberIds.length === 0) {
    return (
      <FeedClient
        phoneVerified={phoneVerified}
        isOldEnough={isOldEnough}
        initialItems={[]}
        initialHasMore={false}
        currentUserId={userId}
        ageVerified={ageVerified}
        showGraphicByDefault={showGraphicByDefault}
        showNsfwContent={showNsfwContent}
        hasEmail={!!currentUser.email}
        isPremium={currentUser.tier === "premium"}
        listId={listId}
        lists={lists}
      />
    );
  }

  // Phase 2: posts + reposts in parallel
  const [posts, reposts] = await Promise.all([
    prisma.post.findMany({
      where: {
        authorId: { in: memberIds },
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
        userId: { in: memberIds },
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
      showNsfwContent={showNsfwContent}
      hasEmail={!!currentUser.email}
      isPremium={currentUser.tier === "premium"}
      listId={listId}
    />
  );
}
