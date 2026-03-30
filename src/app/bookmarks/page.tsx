import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { calculateAge } from "@/lib/age-gate";
import { isProfileIncomplete } from "@/lib/require-profile";
import { userThemeSelect, buildUserTheme } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";

export const metadata: Metadata = {
  title: "Bookmarks",
  robots: { index: false, follow: false },
};

export default async function BookmarksPage() {
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
      hideSensitiveOverlay: true,
      showNsfwContent: true,
      ...userThemeSelect,
    },
  });

  if (!currentUser || isProfileIncomplete(currentUser)) redirect("/complete-profile");

  const phoneVerified = !!currentUser?.phoneVerified;
  const ageVerified = !!currentUser?.ageVerified;
  const showGraphicByDefault = currentUser?.showGraphicByDefault ?? false;
  const hideSensitiveOverlay = currentUser?.hideSensitiveOverlay ?? false;
  const showNsfwContent = currentUser?.showNsfwContent ?? false;
  const theme = buildUserTheme(currentUser);
  const isOldEnough = currentUser?.dateOfBirth
    ? calculateAge(currentUser.dateOfBirth) >= 18
    : false;

  const bookmarks = await prisma.bookmark.findMany({
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
                  usernameFont: true,
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

  const posts = bookmarks.map((b) => b.post);

  return (
    <ThemedPage {...theme}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-600">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Bookmarks
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Posts you&apos;ve saved for later
          </p>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-zinc-500">No bookmarks yet.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Bookmark posts to save them for later.
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
              hideSensitiveOverlay={hideSensitiveOverlay}
              showNsfwContent={showNsfwContent}
              {...(post.wallPost && post.wallPost.wallOwner.username && {
                wallOwner: {
                  username: post.wallPost.wallOwner.username,
                  displayName: post.wallPost.wallOwner.displayName,
                  usernameFont: post.wallPost.wallOwner.usernameFont,
                },
                wallPostId: post.wallPost.id,
                wallPostStatus: post.wallPost.status,
              })}
            />
          ))}
        </div>
      )}
    </ThemedPage>
  );
}
