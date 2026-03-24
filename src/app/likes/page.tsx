import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { calculateAge } from "@/lib/age-gate";
import { isProfileIncomplete } from "@/lib/require-profile";

export const metadata: Metadata = {
  title: "Likes",
  robots: { index: false, follow: false },
};

export default async function LikesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const currentUser = await prisma.user.findUnique({
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
  });

  if (!currentUser || isProfileIncomplete(currentUser)) redirect("/complete-profile");

  const phoneVerified = !!currentUser?.phoneVerified;
  const ageVerified = !!currentUser?.ageVerified;
  const showGraphicByDefault = currentUser?.showGraphicByDefault ?? false;
  const showNsfwContent = currentUser?.showNsfwContent ?? false;

  const likes = await prisma.like.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      post: {
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              name: true,
              image: true,
              avatar: true,
              profileFrameId: true,
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
          tags: {
            include: {
              tag: { select: { name: true } },
            },
          },
          wallPost: {
            select: {
              id: true,
              status: true,
              wallOwner: {
                select: {
                  username: true,
                  displayName: true,
                },
              },
            },
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
                  profileFrameId: true,
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
                      profileFrameId: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const posts = likes.map((l) => l.post);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-rose-600">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Liked Posts
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Posts you&apos;ve liked
          </p>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-zinc-500">No liked posts yet.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Like posts to see them here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={userId}
              phoneVerified={phoneVerified}
              ageVerified={ageVerified}
              showGraphicByDefault={showGraphicByDefault}
              showNsfwContent={showNsfwContent}
              {...(post.wallPost && post.wallPost.wallOwner.username && {
                wallOwner: {
                  username: post.wallPost.wallOwner.username,
                  displayName: post.wallPost.wallOwner.displayName,
                },
                wallPostId: post.wallPost.id,
                wallPostStatus: post.wallPost.status,
              })}
            />
          ))}
        </div>
      )}
    </main>
  );
}
