"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
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
  biometricVerified,
  showNsfwByDefault,
}: {
  initialItems: FeedItem[];
  initialHasMore: boolean;
  currentUserId: string;
  phoneVerified: boolean;
  biometricVerified: boolean;
  showNsfwByDefault: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;

    const lastItem = items[items.length - 1];
    if (!lastItem) return;

    startTransition(async () => {
      try {
        const result = await fetchFeedPage(lastItem.date);

        const existingIds = new Set(
          items.map((item) =>
            item.type === "post" ? item.data.id : `repost-${item.data.id}`
          )
        );

        const newItems = result.items.filter((item: FeedItem) => {
          const key =
            item.type === "post" ? item.data.id : `repost-${item.data.id}`;
          return !existingIds.has(key);
        });

        setItems((prev) => [...prev, ...newItems]);
        setHasMore(result.hasMore);
      } finally {
        loadingRef.current = false;
      }
    });
  }, [items, hasMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

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
    <div className="mt-6 space-y-4">
      {items.map((item) =>
        item.type === "post" ? (
          <PostCard
            key={item.data.id}
            post={item.data}
            currentUserId={currentUserId}
            phoneVerified={phoneVerified}
            biometricVerified={biometricVerified}
            showNsfwByDefault={showNsfwByDefault}
          />
        ) : (
          <RepostCard
            key={`repost-${item.data.id}`}
            repost={item.data}
            currentUserId={currentUserId}
            phoneVerified={phoneVerified}
            biometricVerified={biometricVerified}
            showNsfwByDefault={showNsfwByDefault}
          />
        )
      )}

      <div ref={sentinelRef} className="h-1" />

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
