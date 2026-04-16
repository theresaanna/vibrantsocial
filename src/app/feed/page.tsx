import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { FeedContent } from "./feed-content";
import { ListFeedContent } from "./list-feed-content";
import { CloseFriendsFeedContent } from "./close-friends-feed-content";

import { LikesFeedContent } from "./likes-feed-content";
import { BookmarksFeedContent } from "./bookmarks-feed-content";
import { FeedSkeleton } from "@/components/feed-skeleton";
import { FeedTabs } from "@/components/feed-tabs";
import { getUserLists, getSubscribedLists, getListInfo } from "@/app/lists/actions";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";
import { checkProfileCompletion } from "@/lib/require-profile";
import { FeedTopWidgets } from "./feed-top-widgets";

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

  const profileRedirect = await checkProfileCompletion(session.user.id);
  if (profileRedirect) redirect(profileRedirect);

  const { list: activeListId, view } = await searchParams;

  // Random moved to /explore
  if (activeListId === "for-you") redirect("/explore?view=random");

  const activeView = view === "media" ? "media" : "posts";
  const [ownedLists, subscribedLists, themeUser] = await Promise.all([
    getUserLists(),
    getSubscribedLists(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: userThemeSelect,
    }),
  ]);

  const theme = themeUser ? buildUserTheme(themeUser) : null;

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
  const isCustomList = activeListId && activeListId !== "close-friends" && activeListId !== "likes" && activeListId !== "bookmarks";
  const activeListInfo = isCustomList && !knownIds.has(activeListId)
    ? await getListInfo(activeListId)
    : null;

  // Verify list exists before entering Suspense to avoid delayed redirects
  if (isCustomList && !knownIds.has(activeListId) && !activeListInfo) {
    redirect("/feed");
  }

  return (
    <ThemedPage {...(theme ?? NO_THEME)}>
      {!activeListId && (
        <Suspense fallback={null}>
          <FeedTopWidgets userId={session.user.id} />
        </Suspense>
      )}
      <FeedTabs
        lists={allTabs}
        activeListId={activeListId}
        activeListInfo={activeListInfo ? {
          id: activeListInfo.id,
          name: activeListInfo.name,
          ownerUsername: activeListInfo.owner.username,
        } : null}
        hasCustomTheme={theme?.hasCustomTheme ?? false}
      />
      <Suspense key={`${activeListId ?? "main-feed"}-${activeView}`} fallback={<FeedSkeleton />}>
        {activeListId === "close-friends" ? (
          <CloseFriendsFeedContent userId={session.user.id} />
        ) : activeListId === "likes" ? (
          <LikesFeedContent userId={session.user.id} />
        ) : activeListId === "bookmarks" ? (
          <BookmarksFeedContent userId={session.user.id} />
        ) : activeListId ? (
          <ListFeedContent userId={session.user.id} listId={activeListId} />
        ) : (
          <FeedContent userId={session.user.id} activeView={activeView} />
        )}
      </Suspense>
    </ThemedPage>
  );
}
