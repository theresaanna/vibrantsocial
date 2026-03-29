import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { isProfileIncomplete } from "@/lib/require-profile";
import { QuotePageClient } from "./quote-page-client";
import { getPostInclude } from "@/app/feed/feed-queries";
import { extractContentFromLexicalJson } from "@/lib/lexical-text";
import { buildMetadata, truncateText, SITE_NAME } from "@/lib/metadata";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const repost = await prisma.repost.findUnique({
    where: { id },
    select: {
      id: true,
      content: true,
      user: {
        select: {
          username: true,
          displayName: true,
          name: true,
          avatar: true,
          profileFrameId: true,
          image: true,
        },
      },
    },
  });

  if (!repost?.user || !repost.content) return { title: "Quote Not Found" };

  const displayName = repost.user.displayName || repost.user.name || repost.user.username;
  const { text, imageUrls } = extractContentFromLexicalJson(repost.content);
  const description = text
    ? truncateText(text, 160)
    : `A quote post by ${displayName} on ${SITE_NAME}.`;
  const avatarUrl = repost.user.avatar || repost.user.image || undefined;
  const ogImage = imageUrls[0] ?? avatarUrl;

  return buildMetadata({
    title: `${displayName} on ${SITE_NAME}`,
    description,
    path: `/quote/${repost.id}`,
    images: ogImage ? [{ url: ogImage, alt: `Quote by ${displayName}` }] : undefined,
  });
}

export default async function QuotePage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  let phoneVerified = false;
  let ageVerified = false;
  let showGraphicByDefault = false;
  let hideSensitiveOverlay = false;
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
        hideSensitiveOverlay: true,
        showNsfwContent: true,
      },
    });

    if (!currentUser || isProfileIncomplete(currentUser)) redirect("/complete-profile");

    phoneVerified = !!currentUser?.phoneVerified;
    ageVerified = !!currentUser?.ageVerified;
    showGraphicByDefault = currentUser?.showGraphicByDefault ?? false;
    hideSensitiveOverlay = currentUser?.hideSensitiveOverlay ?? false;
    showNsfwContent = currentUser?.showNsfwContent ?? false;
  }

  const repost = await prisma.repost.findUnique({
    where: { id },
    include: {
      user: {
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
      post: {
        include: getPostInclude(userId ?? ""),
      },
      tags: {
        include: {
          tag: { select: { name: true } },
        },
      },
      _count: {
        select: {
          likes: true,
          bookmarks: true,
          comments: true,
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
      // Comments are lazy-loaded by RepostCommentSection via fetchRepostComments
      // which builds the full nested tree (not just 2 levels)
    },
  });

  if (!repost || !repost.content) notFound();

  // Redirect unauthenticated visitors away from flagged content
  if (!userId && (repost.isSensitive || repost.isNsfw || repost.isGraphicNudity)) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <QuotePageClient
        repost={JSON.parse(JSON.stringify(repost))}
        currentUserId={userId}
        phoneVerified={phoneVerified}
        ageVerified={ageVerified}
        showGraphicByDefault={showGraphicByDefault}
        hideSensitiveOverlay={hideSensitiveOverlay}
        showNsfwContent={showNsfwContent}
      />
    </main>
  );
}
