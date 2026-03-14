import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { isProfileIncomplete } from "@/lib/require-profile";
import { PostPageClient } from "./post-page-client";
import { extractContentFromLexicalJson } from "@/lib/lexical-text";
import { buildMetadata, truncateText, SITE_NAME } from "@/lib/metadata";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ commentId?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      content: true,
      author: {
        select: {
          username: true,
          displayName: true,
          name: true,
          avatar: true,
          image: true,
        },
      },
    },
  });

  if (!post?.author) return { title: "Post Not Found" };

  const displayName = post.author.displayName || post.author.name || post.author.username;
  const { text, imageUrls } = extractContentFromLexicalJson(post.content);
  const description = text
    ? truncateText(text, 160)
    : `A post by ${displayName} on ${SITE_NAME}.`;
  const avatarUrl = post.author.avatar || post.author.image || undefined;
  const ogImage = imageUrls[0] ?? avatarUrl;

  return buildMetadata({
    title: `${displayName} on ${SITE_NAME}`,
    description,
    path: `/post/${post.id}`,
    images: ogImage ? [{ url: ogImage, alt: `Post by ${displayName}` }] : undefined,
  });
}

export default async function PostPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { commentId } = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;

  let phoneVerified = false;
  let ageVerified = false;
  let showGraphicByDefault = false;
  let showNsfwContent = false;

  if (userId) {
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

    phoneVerified = !!currentUser?.phoneVerified;
    ageVerified = !!currentUser?.ageVerified;
    showGraphicByDefault = currentUser?.showGraphicByDefault ?? false;
    showNsfwContent = currentUser?.showNsfwContent ?? false;
  }

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
          isProfilePublic: true,
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
        where: { userId: userId ?? "" },
        select: { id: true },
      },
      bookmarks: {
        where: { userId: userId ?? "" },
        select: { id: true },
      },
      reposts: {
        where: { userId: userId ?? "" },
        select: { id: true },
      },
      tags: {
        include: {
          tag: { select: { name: true } },
        },
      },
      // Comments are lazy-loaded by CommentSection via fetchComments
      // which builds the full nested tree (not just 2 levels)
    },
  });

  if (!post) notFound();

  // Redirect unauthenticated visitors if author's profile is private
  if (post.author && !post.author.isProfilePublic && !userId) redirect("/login");

  // Redirect unauthenticated visitors away from flagged content
  if (!userId && (post.isSensitive || post.isNsfw || post.isGraphicNudity)) redirect("/login");

  // Close-friends-only posts: only the author and their close friends can view
  if (post.isCloseFriendsOnly && post.author) {
    if (!userId) redirect("/login");
    if (userId !== post.author.id) {
      const isOnCloseFriendsList = await prisma.closeFriend.findUnique({
        where: {
          userId_friendId: { userId: post.author.id, friendId: userId },
        },
      });
      if (!isOnCloseFriendsList) notFound();
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PostPageClient
        post={post}
        currentUserId={userId}
        phoneVerified={phoneVerified}
        ageVerified={ageVerified}
        showGraphicByDefault={showGraphicByDefault}
        showNsfwContent={showNsfwContent}
        highlightCommentId={commentId ?? null}
      />
    </main>
  );
}
