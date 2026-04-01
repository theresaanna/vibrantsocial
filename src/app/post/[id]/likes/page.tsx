import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { getBatchFriendshipStatuses } from "@/app/feed/friend-actions";
import { UserList } from "@/components/user-list";
import { ThemedPage } from "@/components/themed-page";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import type { FollowUser } from "@/app/feed/follow-actions";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: { author: { select: { username: true } } },
  });
  return {
    title: post?.author ? `Likes on @${post.author.username}'s post` : "Post Likes",
    robots: { index: false, follow: false },
  };
}

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  name: true,
  avatar: true,
  image: true,
  profileFrameId: true,
  usernameFont: true,
};

export default async function PostLikesPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const currentUserId = session.user.id;

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      author: { select: { ...USER_SELECT, ...userThemeSelect } },
    },
  });

  if (!post?.author) notFound();

  if (post.author.id !== currentUserId) {
    redirect(`/post/${id}`);
  }

  const likes = await prisma.like.findMany({
    where: { postId: id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: USER_SELECT } },
  });

  const users: FollowUser[] = likes.map((like) => ({
    ...like.user,
    isFollowing: false,
  }));

  const otherUserIds = users.filter((u) => u.id !== currentUserId).map((u) => u.id);
  const [friendshipStatuses, followData] = await Promise.all([
    getBatchFriendshipStatuses(otherUserIds),
    prisma.follow.findMany({
      where: { followerId: currentUserId, followingId: { in: otherUserIds } },
      select: { followingId: true },
    }),
  ]);

  const followingSet = new Set(followData.map((f) => f.followingId));
  for (const user of users) {
    user.isFollowing = followingSet.has(user.id);
  }

  const theme = buildUserTheme(post.author);

  return (
    <ThemedPage {...theme}>
      <div className="rounded-2xl bg-white shadow-lg dark:bg-zinc-900">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <Link
            href={`/post/${id}`}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Back to post"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Liked by ({likes.length})
          </h1>
        </div>

        <UserList
          users={users}
          currentUserId={currentUserId}
          emptyMessage="No likes yet."
          friendshipStatuses={friendshipStatuses}
        />
      </div>
    </ThemedPage>
  );
}
