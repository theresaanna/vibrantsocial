"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { PostCard } from "@/components/post-card";
import { RepostCard } from "@/components/repost-card";
import { fetchFeedPage } from "@/app/feed/feed-actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeedItem = { type: "post" | "repost"; data: any; date: string };

export function FeedList({
  initialItems,
  initialHasMore,
  currentUserId,
  phoneVerified,
  ageVerified,
  showGraphicByDefault,
  showNsfwContent,
  newItems = [],
}: {
  initialItems: FeedItem[];
  initialHasMore: boolean;
  currentUserId: string;
  phoneVerified: boolean;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  showNsfwContent: boolean;
  newItems?: FeedItem[];
}) {
  const [items, setItems] = useState(initialItems);

  // Prepend newly created posts
  useEffect(() => {
    if (newItems.length === 0) return;
    setItems((prev) => {
      const existingIds = new Set(
        prev.map((item) =>
          item.type === "post" ? item.data.id : `repost-${item.data.id}`
        )
      );
      const toAdd = newItems.filter((item) => {
        const key =
          item.type === "post" ? item.data.id : `repost-${item.data.id}`;
        return !existingIds.has(key);
      });
      return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
    });
  }, [newItems]);

  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();
  const loadingRef = useRef(false);

  // Keep items and hasMore in refs so loadMore stays stable
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;

    const currentItems = itemsRef.current;
    const lastItem = currentItems[currentItems.length - 1];
    if (!lastItem) return;

    startTransition(async () => {
      try {
        const result = await fetchFeedPage(lastItem.date);

        const existingIds = new Set(
          itemsRef.current.map((item) =>
            item.type === "post" ? item.data.id : `repost-${item.data.id}`
          )
        );

        const freshItems = result.items.filter((item: FeedItem) => {
          const key =
            item.type === "post" ? item.data.id : `repost-${item.data.id}`;
          return !existingIds.has(key);
        });

        setItems((prev) => [...prev, ...freshItems]);
        setHasMore(result.hasMore);
      } finally {
        loadingRef.current = false;
      }
    });
  }, []);

  // Virtualizer for window-based scrolling
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 250,
    overscan: 5,
    gap: 16,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Trigger loadMore when nearing the end of the list
  useEffect(() => {
    if (virtualItems.length === 0) return;
    const lastVirtualItem = virtualItems[virtualItems.length - 1];
    if (
      lastVirtualItem.index >= items.length - 3 &&
      hasMoreRef.current &&
      !loadingRef.current
    ) {
      loadMore();
    }
  }, [virtualItems, items.length, loadMore]);

  if (items.length === 0) {
    return (
      <div className="mt-8 text-center">
        <p className="text-zinc-500">No posts yet.</p>
        <p className="mt-1 text-sm text-zinc-400">
          Follow people to see their posts here, or create your own!
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={
                item.type === "post"
                  ? item.data.id
                  : `repost-${item.data.id}`
              }
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {item.type === "post" ? (
                <PostCard
                  post={item.data}
                  currentUserId={currentUserId}
                  phoneVerified={phoneVerified}
                  ageVerified={ageVerified}
                  showGraphicByDefault={showGraphicByDefault}
                  showNsfwContent={showNsfwContent}
                />
              ) : (
                <RepostCard
                  repost={item.data}
                  currentUserId={currentUserId}
                  phoneVerified={phoneVerified}
                  ageVerified={ageVerified}
                  showGraphicByDefault={showGraphicByDefault}
                  showNsfwContent={showNsfwContent}
                />
              )}
            </div>
          );
        })}
      </div>

      {isPending && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="py-4 text-center text-sm text-zinc-400">
          You&apos;re all caught up!
        </p>
      )}
    </div>
  );
}
