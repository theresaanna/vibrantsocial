"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { PostCard } from "@/components/post-card";
import { getPostsByTag } from "@/app/tags/actions";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface TagPostListProps {
  tagName: string;
  initialPosts: any[];
  initialHasMore: boolean;
  currentUserId?: string;
  phoneVerified: boolean;
  ageVerified: boolean;
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
  ageVerified,
  showGraphicByDefault,
  showNsfwContent,
}: TagPostListProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [posts, setPosts] = useState<any[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();
  const loadingRef = useRef(false);

  // Keep posts and hasMore in refs so loadMore stays stable
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMoreRef.current) return;
    const currentPosts = postsRef.current;
    const lastPost = currentPosts[currentPosts.length - 1];
    if (!lastPost) return;

    loadingRef.current = true;
    startTransition(async () => {
      try {
        const result = await getPostsByTag(
          tagName,
          currentUserId,
          lastPost.postTagId,
          showNsfwContent
        );
        setPosts((prev) => [...prev, ...result.posts]);
        setHasMore(result.hasMore);
      } finally {
        loadingRef.current = false;
      }
    });
  }, [tagName, currentUserId, showNsfwContent]);

  // Virtualizer for window-based scrolling
  const virtualizer = useWindowVirtualizer({
    count: posts.length,
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
      lastVirtualItem.index >= posts.length - 3 &&
      hasMoreRef.current &&
      !loadingRef.current
    ) {
      loadMore();
    }
  }, [virtualItems, posts.length, loadMore]);

  if (posts.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-zinc-500">No posts with this tag yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const post = posts[virtualRow.index];
          return (
            <div
              key={post.id}
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
              <PostCard
                post={post}
                currentUserId={currentUserId}
                phoneVerified={phoneVerified}
                ageVerified={ageVerified}
                showGraphicByDefault={showGraphicByDefault}
                showNsfwContent={showNsfwContent}
                {...(post.wallPost && {
                  wallOwner: {
                    username: post.wallPost.wallOwner.username,
                    displayName: post.wallPost.wallOwner.displayName,
                    usernameFont: post.wallPost.wallOwner.usernameFont,
                  },
                  wallPostId: post.wallPost.id,
                  wallPostStatus: post.wallPost.status,
                })}
              />
            </div>
          );
        })}
      </div>

      {isPending && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
        </div>
      )}
    </div>
  );
}
