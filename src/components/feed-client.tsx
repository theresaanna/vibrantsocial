"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AddToHomeBanner } from "@/components/add-to-home-banner";
import { AddEmailBanner } from "@/components/add-email-banner";
import { PostComposer } from "@/components/post-composer";
import { FeedList } from "@/components/feed-list";
import { fetchSinglePost, fetchNewFeedItems } from "@/app/feed/feed-actions";
import { fetchNewListFeedItems } from "@/app/lists/actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeedItem = { type: "post" | "repost"; data: any; date: string };

const POLL_INTERVAL_MS = 30_000; // 30 seconds

interface FeedClientProps {
  phoneVerified: boolean;
  isOldEnough: boolean;
  initialItems: FeedItem[];
  initialHasMore: boolean;
  currentUserId: string;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  showNsfwContent: boolean;
  hasEmail: boolean;
  isPremium: boolean;
  listId?: string;
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
  hasEmail,
  isPremium,
  listId,
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
      <PostComposer
        phoneVerified={phoneVerified}
        isOldEnough={isOldEnough}
        isPremium={isPremium}
        onPostCreated={handlePostCreated}
      />
      <FeedList
        initialItems={initialItems}
        initialHasMore={initialHasMore}
        currentUserId={currentUserId}
        phoneVerified={phoneVerified}
        ageVerified={ageVerified}
        showGraphicByDefault={showGraphicByDefault}
        showNsfwContent={showNsfwContent}
        newItems={newItems}
      />
    </>
  );
}
