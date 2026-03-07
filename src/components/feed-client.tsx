"use client";

import { useState, useCallback } from "react";
import { PostComposer } from "@/components/post-composer";
import { FeedList } from "@/components/feed-list";
import { fetchSinglePost } from "@/app/feed/feed-actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeedItem = { type: "post" | "repost"; data: any; date: string };

interface FeedClientProps {
  phoneVerified: boolean;
  isOldEnough: boolean;
  initialItems: FeedItem[];
  initialHasMore: boolean;
  currentUserId: string;
  biometricVerified: boolean;
  showNsfwByDefault: boolean;
}

export function FeedClient({
  phoneVerified,
  isOldEnough,
  initialItems,
  initialHasMore,
  currentUserId,
  biometricVerified,
  showNsfwByDefault,
}: FeedClientProps) {
  const [newItems, setNewItems] = useState<FeedItem[]>([]);

  const handlePostCreated = useCallback(async (postId: string) => {
    const item = await fetchSinglePost(postId);
    if (item) {
      setNewItems((prev) => [item, ...prev]);
    }
  }, []);

  return (
    <>
      <PostComposer
        phoneVerified={phoneVerified}
        isOldEnough={isOldEnough}
        onPostCreated={handlePostCreated}
      />
      <FeedList
        initialItems={initialItems}
        initialHasMore={initialHasMore}
        currentUserId={currentUserId}
        phoneVerified={phoneVerified}
        biometricVerified={biometricVerified}
        showNsfwByDefault={showNsfwByDefault}
        newItems={newItems}
      />
    </>
  );
}
