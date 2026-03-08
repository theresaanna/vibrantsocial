"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { PostCard } from "@/components/post-card";
import { getPostsByTag } from "@/app/tags/actions";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface TagPostListProps {
  tagName: string;
  initialPosts: any[];
  initialHasMore: boolean;
  currentUserId?: string;
  phoneVerified: boolean;
  biometricVerified: boolean;
  showGraphicByDefault: boolean;
  showNsfwContent: boolean;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function TagPostList({
  tagName,
  initialPosts,
  initialHasMore,
  currentUserId,
  phoneVerified,
  biometricVerified,
  showGraphicByDefault,
  showNsfwContent,
}: TagPostListProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [posts, setPosts] = useState<any[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return;
    const lastPost = posts[posts.length - 1];
    if (!lastPost) return;

    loadingRef.current = true;
    startTransition(async () => {
      try {
        const result = await getPostsByTag(
          tagName,
          currentUserId,
          lastPost.postTagId
        );
        setPosts((prev) => [...prev, ...result.posts]);
        setHasMore(result.hasMore);
      } finally {
        loadingRef.current = false;
      }
    });
  }, [tagName, currentUserId, posts, hasMore]);

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

  if (posts.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-zinc-500">No posts with this tag yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          phoneVerified={phoneVerified}
          biometricVerified={biometricVerified}
          showGraphicByDefault={showGraphicByDefault}
          showNsfwContent={showNsfwContent}
        />
      ))}

      <div ref={sentinelRef} className="h-1" />

      {isPending && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
        </div>
      )}
    </div>
  );
}
