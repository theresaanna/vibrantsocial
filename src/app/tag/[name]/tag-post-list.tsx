"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { PostCard } from "@/components/post-card";
import { getPostsByTag, fetchMediaByTag } from "@/app/tags/actions";
import { FeedViewToggle, type FeedView } from "@/components/feed-view-toggle";
import { MediaGrid, type MediaPost } from "@/components/media-grid";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface TagPostListProps {
  tagName: string;
  initialPosts: any[];
  initialHasMore: boolean;
  currentUserId?: string;
  phoneVerified: boolean;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  hideSensitiveOverlay: boolean;
  hideNsfwOverlay: boolean;
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
  hideSensitiveOverlay,
  hideNsfwOverlay,
  showNsfwContent,
}: TagPostListProps) {
  const [activeView, setActiveView] = useState<FeedView>("posts");
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

  const mediaFetchPage = useCallback(
    (cursor?: string) => fetchMediaByTag(tagName, showNsfwContent, cursor),
    [tagName, showNsfwContent]
  );

  return (
    <>
      <FeedViewToggle activeView={activeView} onViewChange={setActiveView} />

      {activeView === "media" ? (
        <TagMediaContent tagName={tagName} showNsfwContent={showNsfwContent} fetchPage={mediaFetchPage} />
      ) : posts.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-zinc-500">No posts with this tag yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              phoneVerified={phoneVerified}
              ageVerified={ageVerified}
              showGraphicByDefault={showGraphicByDefault}
              showNsfwContent={showNsfwContent}
              hideSensitiveOverlay={hideSensitiveOverlay}
              hideNsfwOverlay={hideNsfwOverlay}
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
          ))}

          {/* Sentinel element for infinite scroll */}
          <div ref={sentinelRef} aria-hidden="true" />

          {isPending && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function TagMediaContent({
  tagName,
  showNsfwContent,
  fetchPage,
}: {
  tagName: string;
  showNsfwContent: boolean;
  fetchPage: (cursor?: string) => Promise<{ posts: MediaPost[]; hasMore: boolean }>;
}) {
  const [data, setData] = useState<{ posts: MediaPost[]; hasMore: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchMediaByTag(tagName, showNsfwContent);
      setData(result);
    });
  }, [tagName, showNsfwContent]);

  if (!data || isPending) {
    return (
      <div className="mt-6 flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
      </div>
    );
  }

  return <MediaGrid initialPosts={data.posts} initialHasMore={data.hasMore} fetchPage={fetchPage} />;
}
