"use client";

import { useEffect, useState, useTransition } from "react";
import { MediaGrid, type MediaPost } from "@/components/media-grid";
import { fetchCommunitiesMediaPage } from "./media-actions";

export function CommunitiesMediaClient() {
  const [posts, setPosts] = useState<MediaPost[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchCommunitiesMediaPage();
      setPosts(result.posts);
      setHasMore(result.hasMore);
    });
  }, []);

  if (posts === null || isPending) {
    return (
      <div className="mt-6 flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
      </div>
    );
  }

  return (
    <MediaGrid
      initialPosts={posts}
      initialHasMore={hasMore}
      fetchPage={fetchCommunitiesMediaPage}
    />
  );
}
