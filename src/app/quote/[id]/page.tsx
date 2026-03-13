import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { isProfileIncomplete } from "@/lib/require-profile";
import { QuotePageClient } from "./quote-page-client";
import { getPostInclude } from "@/app/feed/feed-queries";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function QuotePage({ params }: Props) {
  const { id } = await params;
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
        showNsfwContent={showNsfwContent}
      />
    </main>
  );
}
