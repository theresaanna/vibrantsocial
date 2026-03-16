import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { isProfileIncomplete } from "@/lib/require-profile";
import { QuotePostPage } from "./quote-post-page";

export const metadata: Metadata = {
  title: "Quote Post",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function QuotePage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) redirect("/login");

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, email: true, dateOfBirth: true },
  });

  if (!currentUser || isProfileIncomplete(currentUser)) redirect("/complete-profile");

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      content: true,
      createdAt: true,
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
  });

  if (!post || !post.author) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <QuotePostPage
        postId={post.id}
        originalAuthor={post.author.username || "unknown"}
        originalAuthorDisplayName={post.author.displayName || post.author.name || "Anonymous"}
        originalAuthorAvatar={post.author.avatar || post.author.image}
        originalContent={post.content}
        originalCreatedAt={post.createdAt.toISOString()}
      />
    </main>
  );
}
