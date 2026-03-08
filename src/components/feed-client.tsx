"use client";

import { useState, useCallback } from "react";
import { AddToHomeBanner } from "@/components/add-to-home-banner";
import { UpdateBanner } from "@/components/update-banner";
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
  showGraphicByDefault: boolean;
  showNsfwContent: boolean;
}

export function FeedClient({
  phoneVerified,
  isOldEnough,
  initialItems,
  initialHasMore,
  currentUserId,
  biometricVerified,
  showGraphicByDefault,
  showNsfwContent,
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
      <UpdateBanner />
      <AddToHomeBanner />
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
        showGraphicByDefault={showGraphicByDefault}
        showNsfwContent={showNsfwContent}
        newItems={newItems}
      />
    </>
  );
}
