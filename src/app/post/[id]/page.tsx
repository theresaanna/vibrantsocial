import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { calculateAge } from "@/lib/age-gate";
import { PostPageClient } from "./post-page-client";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ commentId?: string }>;
}

export default async function PostPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { commentId } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      phoneVerified: true,
      dateOfBirth: true,
      biometricVerified: true,
      showNsfwByDefault: true,
    },
  });

  if (!currentUser?.dateOfBirth) redirect("/complete-profile");

  const phoneVerified = !!currentUser?.phoneVerified;
  const biometricVerified = !!currentUser?.biometricVerified;
  const showNsfwByDefault = currentUser?.showNsfwByDefault ?? false;

  const post = await prisma.post.findUnique({
    where: { id },
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

  if (!post) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PostPageClient
        post={post}
        currentUserId={userId}
        phoneVerified={phoneVerified}
        biometricVerified={biometricVerified}
        showNsfwByDefault={showNsfwByDefault}
        highlightCommentId={commentId ?? null}
      />
    </main>
  );
}
