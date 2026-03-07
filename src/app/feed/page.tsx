import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PostComposer } from "@/components/post-composer";
import { PostCard } from "@/components/post-card";
import { RepostCard } from "@/components/repost-card";
import { calculateAge } from "@/lib/age-gate";

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

  const postInclude = {
    author: {
      select: {
        id: true,
        username: true,
        displayName: true,
        name: true,
        image: true,
        avatar: true,
      },
    },
    _count: {
      select: {
        comments: true,
        likes: true,
        bookmarks: true,
        reposts: true,
      },
    },
    likes: {
      where: { userId },
      select: { id: true },
    },
    bookmarks: {
      where: { userId },
      select: { id: true },
    },
    reposts: {
      where: { userId },
      select: { id: true },
    },
    comments: {
      where: { parentId: null },
      orderBy: { createdAt: "asc" as const },
      take: 5,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            name: true,
            image: true,
            avatar: true,
          },
        },
        replies: {
          orderBy: { createdAt: "asc" as const },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                name: true,
                image: true,
                avatar: true,
              },
            },
          },
        },
      },
    },
  };

  // Posts from followed users + own posts
  const posts = await prisma.post.findMany({
    where: {
      authorId: { in: [...followingIds, userId] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: postInclude,
  });

  // Reposts from followed users (both regular and quote reposts)
  const reposts = await prisma.repost.findMany({
    where: {
      userId: { in: followingIds },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          image: true,
          avatar: true,
        },
      },
      post: { include: postInclude },
    },
  });

  // Merge posts and reposts chronologically
  type FeedItem =
    | { type: "post"; data: (typeof posts)[number]; date: Date }
    | { type: "repost"; data: (typeof reposts)[number]; date: Date };

  // Deduplicate: if a post appears both directly and via repost, keep the direct post
  const directPostIds = new Set(posts.map((p) => p.id));
  const filteredReposts = reposts.filter((r) => !directPostIds.has(r.post.id));

  const feedItems: FeedItem[] = [
    ...posts.map((p) => ({ type: "post" as const, data: p, date: p.createdAt })),
    ...filteredReposts.map((r) => ({ type: "repost" as const, data: r, date: r.createdAt })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PostComposer phoneVerified={phoneVerified} isOldEnough={isOldEnough} />

      {feedItems.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-zinc-500">No posts yet.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Follow people to see their posts here, or create your own!
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {feedItems.map((item) =>
            item.type === "post" ? (
              <PostCard key={item.data.id} post={item.data} currentUserId={userId} phoneVerified={phoneVerified} biometricVerified={biometricVerified} showNsfwByDefault={showNsfwByDefault} />
            ) : (
              <RepostCard key={`repost-${item.data.id}`} repost={item.data} currentUserId={userId} phoneVerified={phoneVerified} biometricVerified={biometricVerified} showNsfwByDefault={showNsfwByDefault} />
            )
          )}
        </div>
      )}
    </main>
  );
}
