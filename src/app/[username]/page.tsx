import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { FollowButton } from "@/components/follow-button";
import { BioContent } from "@/components/bio-content";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export default async function PublicProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      name: true,
      image: true,
      avatar: true,
      bio: true,
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
        },
      },
    },
  });

  if (!user) notFound();

  const session = await auth();
  const currentUserId = session?.user?.id;
  const isOwnProfile = currentUserId === user.id;

  // Check if current user follows this profile
  let isFollowing = false;
  let phoneVerified = false;

  if (currentUserId && !isOwnProfile) {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: user.id,
        },
      },
    });
    isFollowing = !!follow;
  }

  if (currentUserId) {
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { phoneVerified: true },
    });
    phoneVerified = !!currentUser?.phoneVerified;
  }

  // Fetch user's posts
  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
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
        where: { userId: currentUserId ?? "" },
        select: { id: true },
      },
      bookmarks: {
        where: { userId: currentUserId ?? "" },
        select: { id: true },
      },
      reposts: {
        where: { userId: currentUserId ?? "" },
        select: { id: true },
      },
      comments: {
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
        },
      },
    },
  });

  const displayName = user.displayName || user.name || user.username;
  const avatarSrc = user.avatar || user.image;
  const initial = (displayName || "?")[0].toUpperCase();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* Profile header */}
      <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
        <div className="flex items-start gap-4">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-full"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 text-xl font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
              {initial}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {displayName}
                </h1>
                <p className="text-sm text-zinc-500">@{user.username}</p>
              </div>

              {currentUserId && !isOwnProfile && (
                <FollowButton userId={user.id} isFollowing={isFollowing} />
              )}
            </div>

            {user.bio && (
              <div className="mt-2">
                <BioContent content={user.bio} />
              </div>
            )}

            <div className="mt-3 flex gap-4 text-sm">
              <span className="text-zinc-500">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {user._count.posts}
                </span>{" "}
                posts
              </span>
              <span className="text-zinc-500">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {user._count.followers}
                </span>{" "}
                followers
              </span>
              <span className="text-zinc-500">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {user._count.following}
                </span>{" "}
                following
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* User's posts */}
      {posts.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-zinc-500">No posts yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} phoneVerified={phoneVerified} />
          ))}
        </div>
      )}
    </main>
  );
}
