"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { AddToHomeBanner } from "@/components/add-to-home-banner";
import { AddEmailBanner } from "@/components/add-email-banner";
import { FeedList } from "@/components/feed-list";
import { fetchSinglePost, fetchNewFeedItems } from "@/app/feed/feed-actions";
import { fetchNewListFeedItems } from "@/app/lists/actions";
import { FeedSummaryBanner } from "@/components/feed-summary-banner";
import { FeedViewToggleWrapper } from "@/components/feed-view-toggle-wrapper";
import { MediaFeedClientContent } from "@/components/media-feed-client-content";
import type { FeedView } from "@/components/feed-view-toggle";

const PostComposer = dynamic(
  () => import("@/components/post-composer").then((m) => ({ default: m.PostComposer })),
  { ssr: false }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeedItem = { type: "post" | "repost"; data: any; date: string };

const POLL_INTERVAL_MS = 60_000; // 60 seconds

interface FeedClientProps {
  phoneVerified: boolean;
  isOldEnough: boolean;
  initialItems: FeedItem[];
  initialHasMore: boolean;
  currentUserId: string;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  showNsfwContent: boolean;
  hideSensitiveOverlay: boolean;
  hasEmail: boolean;
  isPremium: boolean;
  listId?: string;
  lastSeenFeedAt?: string | null;
  activeView?: FeedView;
}

export function FeedClient({
  phoneVerified,
  isOldEnough,
  initialItems,
  initialHasMore,
  currentUserId,
  ageVerified,
  showGraphicByDefault,
  showNsfwContent,
  hideSensitiveOverlay,
  hasEmail,
  isPremium,
  listId,
  lastSeenFeedAt,
  activeView = "posts",
}: FeedClientProps) {
  const [newItems, setNewItems] = useState<FeedItem[]>([]);
  const newestDateRef = useRef<string>(
    initialItems[0]?.date ?? new Date().toISOString()
  );

  // Keep newestDateRef in sync when new items arrive
  useEffect(() => {
    if (newItems.length > 0 && newItems[0].date > newestDateRef.current) {
      newestDateRef.current = newItems[0].date;
    }
  }, [newItems]);

  const handlePostCreated = useCallback(async (postId: string) => {
    const item = await fetchSinglePost(postId);
    if (item) {
      setNewItems((prev) => [item, ...prev]);
    }
  }, []);

  // Poll for new posts from followed users
  useEffect(() => {
    const interval = setInterval(async () => {
      // Only poll when tab is visible
      if (document.hidden) return;

      try {
        const items = listId
          ? await fetchNewListFeedItems(listId, newestDateRef.current)
          : await fetchNewFeedItems(newestDateRef.current);
        if (items.length > 0) {
          setNewItems((prev) => {
            const existingIds = new Set(
              prev.map((item) =>
                item.type === "post" ? item.data.id : `repost-${item.data.id}`
              )
            );
            const toAdd = items.filter((item: FeedItem) => {
              const key =
                item.type === "post"
                  ? item.data.id
                  : `repost-${item.data.id}`;
              return !existingIds.has(key);
            });
            if (toAdd.length === 0) return prev;
            return [...toAdd, ...prev];
          });
        }
      } catch {
        // Non-critical — will retry next interval
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [listId]);

  return (
    <>
      <AddToHomeBanner />
      <AddEmailBanner hasEmail={hasEmail} />
      {!listId && lastSeenFeedAt && (
        <FeedSummaryBanner lastSeenFeedAt={lastSeenFeedAt} />
      )}
      {!listId && activeView === "posts" && (
        <PostComposer
          phoneVerified={phoneVerified}
          isOldEnough={isOldEnough}
          isPremium={isPremium}
          isAgeVerified={ageVerified}
          onPostCreated={handlePostCreated}
        />
      )}
      {!listId && (
        <FeedViewToggleWrapper activeView={activeView} />
      )}
      {activeView === "media" ? (
        <MediaFeedClientContent />
      ) : (
        <FeedList
          initialItems={initialItems}
          initialHasMore={initialHasMore}
          currentUserId={currentUserId}
          phoneVerified={phoneVerified}
          ageVerified={ageVerified}
          showGraphicByDefault={showGraphicByDefault}
          showNsfwContent={showNsfwContent}
          hideSensitiveOverlay={hideSensitiveOverlay}
          newItems={newItems}
        />
      )}
    </>
  );
}
