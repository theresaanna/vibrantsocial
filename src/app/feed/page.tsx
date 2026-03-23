import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FeedContent } from "./feed-content";
import { ListFeedContent } from "./list-feed-content";
import { FeedSkeleton } from "@/components/feed-skeleton";
import { FeedTabs } from "@/components/feed-tabs";
import { getUserLists } from "@/app/lists/actions";

export const metadata: Metadata = {
  title: "Feed",
  robots: { index: false, follow: false },
};

interface FeedPageProps {
  searchParams: Promise<{ list?: string }>;
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { list: activeListId } = await searchParams;
  const lists = await getUserLists();

  const listSummaries = lists.map((l: { id: string; name: string }) => ({
    id: l.id,
    name: l.name,
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {listSummaries.length > 0 && <FeedTabs lists={listSummaries} />}
      <Suspense fallback={<FeedSkeleton />}>
        {activeListId ? (
          <ListFeedContent userId={session.user.id} listId={activeListId} />
        ) : (
          <FeedContent userId={session.user.id} />
        )}
      </Suspense>
    </main>
  );
}
