"use client";

import { useState, useCallback, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { extractMediaFromLexicalJson, type MediaItem } from "@/lib/lexical-text";
import { FramedAvatar } from "@/components/framed-avatar";
import { timeAgo } from "@/lib/time";
import { fetchMarketplacePage, type MarketplaceMediaPost } from "@/app/marketplace/media-actions";

interface MarketplaceGridItem {
  media: MediaItem;
  post: MarketplaceMediaPost;
}

function extractMarketplaceGridItems(posts: MarketplaceMediaPost[]): MarketplaceGridItem[] {
  const items: MarketplaceGridItem[] = [];
  for (const post of posts) {
    const media = extractMediaFromLexicalJson(post.content);
    // Only take the first media item per post for the grid
    if (media.length > 0) {
      items.push({ media: media[0], post });
    }
  }
  return items;
}

function getPostHref(post: MarketplaceMediaPost): string {
  if (post.slug && post.author?.username) {
    return `/${post.author.username}/post/${post.slug}`;
  }
  return `/post/${post.id}`;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

function MediaThumbnail({ item }: { item: MarketplaceGridItem }) {
  const { media } = item;

  if (media.type === "image") {
    return (
      <img
        src={media.src}
        alt={media.altText ?? "Listing image"}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }

  if (media.type === "video") {
    return (
      <div className="relative h-full w-full bg-zinc-900">
        <video
          src={media.src}
          className="h-full w-full object-cover"
          muted
          preload="metadata"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60">
            <svg className="ml-1 h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  if (media.type === "youtube" && media.videoID) {
    return (
      <div className="relative h-full w-full">
        <img
          src={`https://img.youtube.com/vi/${media.videoID}/hqdefault.jpg`}
          alt="YouTube video thumbnail"
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600">
            <svg className="ml-1 h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export type MarketplaceFetchFn = (cursor?: string) => Promise<{ posts: MarketplaceMediaPost[]; hasMore: boolean }>;

interface MarketplaceGridProps {
  initialPosts: MarketplaceMediaPost[];
  initialHasMore: boolean;
  fetchPage?: MarketplaceFetchFn;
}

export function MarketplaceGrid({
  initialPosts,
  initialHasMore,
  fetchPage = fetchMarketplacePage,
}: MarketplaceGridProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const items = extractMarketplaceGridItems(posts);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;

    const lastPost = posts[posts.length - 1];
    if (!lastPost) return;

    startTransition(async () => {
      try {
        const result = await fetchPage(lastPost.createdAt);
        if (result.posts.length > 0) {
          setPosts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const fresh = result.posts.filter(
              (p: MarketplaceMediaPost) => !existingIds.has(p.id)
            );
            return [...prev, ...fresh];
          });
        }
        setHasMore(result.hasMore);
      } finally {
        loadingRef.current = false;
      }
    });
  }, [posts, hasMore, fetchPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (items.length === 0) {
    return (
      <div className="mt-8 text-center">
        <p className="text-zinc-500">No marketplace listings yet.</p>
        <p className="mt-1 text-sm text-zinc-400">
          Items listed for sale will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"
        data-testid="marketplace-grid"
      >
        {items.map((item, index) => (
          <Link
            key={`${item.post.id}-${index}`}
            href={getPostHref(item.post)}
            className="group relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
            data-testid="marketplace-grid-item"
          >
            <MediaThumbnail item={item} />
            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
            {/* Price badge */}
            {item.post.marketplacePost && (
              <div className="absolute top-2 left-2 rounded-full bg-pink-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow-md">
                {formatPrice(item.post.marketplacePost.price)}
              </div>
            )}
            {/* Bottom overlay with seller info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex items-center gap-1.5">
                {item.post.author && (
                  <>
                    <FramedAvatar
                      src={item.post.author.avatar ?? item.post.author.image}
                      alt={item.post.author.displayName ?? item.post.author.username ?? ""}
                      size={20}
                      frameId={item.post.author.profileFrameId}
                    />
                    <span className="truncate text-xs font-medium text-white">
                      {item.post.author.displayName ?? item.post.author.username}
                    </span>
                  </>
                )}
                <span className="ml-auto shrink-0 text-xs text-white/70">
                  {timeAgo(item.post.createdAt)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div ref={sentinelRef} className="h-1" />

      {isPending && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="py-4 text-center text-sm text-zinc-400">
          No more listings to show.
        </p>
      )}
    </div>
  );
}
