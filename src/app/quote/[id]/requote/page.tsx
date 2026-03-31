import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { isProfileIncomplete } from "@/lib/require-profile";
import { QuotePostPage } from "@/app/post/[id]/quote/quote-post-page";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";

export const metadata: Metadata = {
  title: "Quote Post",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RequotePage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) redirect("/login");

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, email: true, dateOfBirth: true },
  });

  if (!currentUser || isProfileIncomplete(currentUser)) redirect("/complete-profile");

  const repost = await prisma.repost.findUnique({
    where: { id },
    select: {
      id: true,
      postId: true,
      content: true,
      createdAt: true,
      user: {
        select: {
          ...userThemeSelect,
          id: true,
          username: true,
          displayName: true,
          name: true,
          image: true,
          avatar: true,
          profileFrameId: true,
          usernameFont: true,
        },
      },
    },
  });

  if (!repost || !repost.user) notFound();

  const theme = buildUserTheme(repost.user);

  return (
    <ThemedPage {...(theme ?? NO_THEME)}>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <QuotePostPage
          postId={repost.postId}
          quotedRepostId={repost.id}
          originalAuthor={repost.user.username || "unknown"}
          originalAuthorDisplayName={repost.user.displayName || repost.user.name || repost.user.username || "Anonymous"}
          originalAuthorAvatar={repost.user.avatar || repost.user.image}
          originalContent={repost.content || ""}
          originalCreatedAt={repost.createdAt.toISOString()}
        />
      </main>
    </ThemedPage>
  );
}
