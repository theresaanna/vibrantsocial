import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PostComposer } from "@/components/post-composer";
import { FeedList } from "@/components/feed-list";
import { calculateAge } from "@/lib/age-gate";
import { getPostInclude, repostUserSelect, PAGE_SIZE } from "./feed-queries";

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Check phone verification for composer / comment gating
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneVerified: true, dateOfBirth: true, biometricVerified: true, showNsfwByDefault: true },
  });

  if (!currentUser?.dateOfBirth) redirect("/complete-profile");

  const phoneVerified = !!currentUser?.phoneVerified;
  const biometricVerified = !!currentUser?.biometricVerified;
  const showNsfwByDefault = currentUser?.showNsfwByDefault ?? false;
  const isOldEnough = currentUser?.dateOfBirth
    ? calculateAge(currentUser.dateOfBirth) >= 18
    : false;

  // Get IDs of users the current user follows
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });

  const followingIds = following.map((f) => f.followingId);
  const postInclude = getPostInclude(userId);
  const fetchCount = PAGE_SIZE + 1;

  // Posts from followed users + own posts
  const posts = await prisma.post.findMany({
    where: {
      authorId: { in: [...followingIds, userId] },
    },
    orderBy: { createdAt: "desc" },
    take: fetchCount,
    include: postInclude,
  });

  // Reposts from followed users (both regular and quote reposts)
  const reposts = await prisma.repost.findMany({
    where: {
      userId: { in: followingIds },
    },
    orderBy: { createdAt: "desc" },
    take: fetchCount,
    include: {
      user: { select: repostUserSelect },
      post: { include: postInclude },
    },
  });

  // Deduplicate: if a post appears both directly and via repost, keep the direct post
  const directPostIds = new Set(posts.map((p) => p.id));
  const filteredReposts = reposts.filter((r) => !directPostIds.has(r.post.id));

  // Merge and sort chronologically, serialize for client component
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
      <PostComposer phoneVerified={phoneVerified} isOldEnough={isOldEnough} />
      <FeedList
        initialItems={initialItems}
        initialHasMore={hasMore}
        currentUserId={userId}
        phoneVerified={phoneVerified}
        biometricVerified={biometricVerified}
        showNsfwByDefault={showNsfwByDefault}
      />
    </main>
  );
}
