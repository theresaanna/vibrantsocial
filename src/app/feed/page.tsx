import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PostComposer } from "@/components/post-composer";
import { PostCard } from "@/components/post-card";
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

  // Posts from followed users + own posts
  const posts = await prisma.post.findMany({
    where: {
      authorId: { in: [...followingIds, userId] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
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
        orderBy: { createdAt: "asc" },
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
            orderBy: { createdAt: "asc" },
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
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PostComposer phoneVerified={phoneVerified} isOldEnough={isOldEnough} />

      {posts.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-zinc-500">No posts yet.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Follow people to see their posts here, or create your own!
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={userId} phoneVerified={phoneVerified} biometricVerified={biometricVerified} showNsfwByDefault={showNsfwByDefault} />
          ))}
        </div>
      )}
    </main>
  );
}
