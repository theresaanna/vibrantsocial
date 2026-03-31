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
  ageVerified,
  showGraphicByDefault,
  showNsfwContent,
  hideSensitiveOverlay,
  newItems = [],
}: {
  initialItems: FeedItem[];
  initialHasMore: boolean;
  currentUserId: string;
  phoneVerified: boolean;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  showNsfwContent: boolean;
  hideSensitiveOverlay: boolean;
  newItems?: FeedItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();
  const loadingRef = useRef(false);

  // Keep items and hasMore in refs so loadMore stays stable
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

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

  const handleDelete = useCallback((type: "post" | "repost", id: string) => {
    setItems((prev) =>
      prev.filter((i) => !(i.type === type && i.data.id === id))
    );
  }, []);

  // IntersectionObserver for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
          loadMore();
        }
      },
      { rootMargin: "600px" }
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
    <div className="mt-6 flex flex-col gap-4">
      {items.map((item) => {
        const key =
          item.type === "post" ? item.data.id : `repost-${item.data.id}`;
        return item.type === "post" ? (
          <PostCard
            key={key}
            post={item.data}
            currentUserId={currentUserId}
            phoneVerified={phoneVerified}
            ageVerified={ageVerified}
            showGraphicByDefault={showGraphicByDefault}
            showNsfwContent={showNsfwContent}
            hideSensitiveOverlay={hideSensitiveOverlay}
            onDelete={() => handleDelete("post", item.data.id)}
            {...(item.data.wallPost && {
              wallOwner: {
                username: item.data.wallPost.wallOwner.username,
                displayName: item.data.wallPost.wallOwner.displayName,
                usernameFont: item.data.wallPost.wallOwner.usernameFont,
              },
              wallPostId: item.data.wallPost.id,
              wallPostStatus: item.data.wallPost.status,
            })}
            {...(item.data.marketplacePost && {
              marketplacePostId: item.data.marketplacePost.id,
              marketplaceData: {
                price: item.data.marketplacePost.price,
                purchaseUrl: item.data.marketplacePost.purchaseUrl,
                shippingOption: item.data.marketplacePost.shippingOption,
                shippingPrice: item.data.marketplacePost.shippingPrice,
              },
            })}
          />
        ) : (
          <RepostCard
            key={key}
            repost={item.data}
            currentUserId={currentUserId}
            phoneVerified={phoneVerified}
            ageVerified={ageVerified}
            showGraphicByDefault={showGraphicByDefault}
            showNsfwContent={showNsfwContent}
            hideSensitiveOverlay={hideSensitiveOverlay}
            onDelete={() => handleDelete("repost", item.data.id)}
          />
        );
      })}

      {/* Sentinel element for infinite scroll */}
      <div ref={sentinelRef} aria-hidden="true" />

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
