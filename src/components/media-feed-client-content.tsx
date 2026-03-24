"use client";

import { useEffect, useState, useTransition } from "react";
import { MediaGrid } from "@/components/media-grid";
import { fetchMediaFeedPage } from "@/app/feed/media-actions";

interface MediaPost {
  id: string;
  slug: string | null;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    image: string | null;
    avatar: string | null;
    profileFrameId: string | null;
  } | null;
}

export function MediaFeedClientContent() {
  const [posts, setPosts] = useState<MediaPost[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchMediaFeedPage();
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

  return <MediaGrid initialPosts={posts} initialHasMore={hasMore} />;
}
