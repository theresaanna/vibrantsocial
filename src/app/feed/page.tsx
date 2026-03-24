import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FeedContent } from "./feed-content";
import { ListFeedContent } from "./list-feed-content";
import { MediaFeedContent } from "./media-feed-content";
import { FeedSkeleton } from "@/components/feed-skeleton";
import { FeedTabs } from "@/components/feed-tabs";
import { FeedViewToggleWrapper } from "@/components/feed-view-toggle-wrapper";
import { getUserLists, getSubscribedLists, getListInfo } from "@/app/lists/actions";

export const metadata: Metadata = {
  title: "Feed",
  robots: { index: false, follow: false },
};

interface FeedPageProps {
  searchParams: Promise<{ list?: string; view?: string }>;
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { list: activeListId, view } = await searchParams;
  const activeView = view === "media" ? "media" : "posts";
  const [ownedLists, subscribedLists] = await Promise.all([
    getUserLists(),
    getSubscribedLists(),
  ]);

  // Owned lists (no owner prefix) + subscribed lists (with owner prefix)
  const allTabs = [
    ...ownedLists.map((l: { id: string; name: string }) => ({
      id: l.id,
      name: l.name,
    })),
    ...subscribedLists.map((l: { id: string; name: string; ownerUsername: string | null }) => ({
      id: l.id,
      name: l.name,
      ownerUsername: l.ownerUsername,
    })),
  ];

  // If viewing a list not in owned or subscribed, fetch its info for the tab
  const knownIds = new Set(allTabs.map((t) => t.id));
  const activeListInfo = activeListId && !knownIds.has(activeListId)
    ? await getListInfo(activeListId)
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <FeedTabs
        lists={allTabs}
        activeListId={activeListId}
        activeListInfo={activeListInfo ? {
          id: activeListInfo.id,
          name: activeListInfo.name,
          ownerUsername: activeListInfo.owner.username,
        } : null}
      />
      {!activeListId && (
        <FeedViewToggleWrapper activeView={activeView} />
      )}
      <Suspense key={`${activeListId ?? "main-feed"}-${activeView}`} fallback={<FeedSkeleton />}>
        {activeListId ? (
          <ListFeedContent userId={session.user.id} listId={activeListId} />
        ) : activeView === "media" ? (
          <MediaFeedContent />
        ) : (
          <FeedContent userId={session.user.id} />
        )}
      </Suspense>
    </main>
  );
}
