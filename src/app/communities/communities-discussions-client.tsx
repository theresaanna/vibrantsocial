"use client";

import { useEffect, useState, useTransition } from "react";
import { PostCard } from "@/components/post-card";
import { fetchTopDiscussedPosts } from "./discussion-actions";

interface DiscussionsData {
  posts: Array<Record<string, unknown>>;
  currentUserId: string | null;
  phoneVerified: boolean;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  hideSensitiveOverlay: boolean;
  hideNsfwOverlay: boolean;
  showNsfwContent: boolean;
}

export function CommunitiesDiscussionsClient() {
  const [data, setData] = useState<DiscussionsData | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchTopDiscussedPosts();
      setData(result);
    });
  }, []);

  if (data === null || isPending) {
    return (
      <div className="mt-6 flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (data.posts.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-lg dark:bg-zinc-900">
        <p className="text-sm text-zinc-500" data-testid="no-discussions">
          No popular discussions in the past week.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="discussions-list">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {data.posts.map((post: any) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={data.currentUserId ?? undefined}
          phoneVerified={data.phoneVerified}
          ageVerified={data.ageVerified}
          showGraphicByDefault={data.showGraphicByDefault}
          hideSensitiveOverlay={data.hideSensitiveOverlay}
          hideNsfwOverlay={data.hideNsfwOverlay}
          showNsfwContent={data.showNsfwContent}
          defaultShowComments
          defaultExpanded
        />
      ))}
    </div>
  );
}
