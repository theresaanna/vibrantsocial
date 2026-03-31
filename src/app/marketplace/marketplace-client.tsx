"use client";

import { useState, useCallback } from "react";
import { MarketplacePostComposer } from "@/components/marketplace-post-composer";
import { MarketplaceGrid } from "@/components/marketplace-grid";
import { fetchSingleMarketplacePost, type MarketplaceMediaPost } from "./media-actions";

interface MarketplaceClientProps {
  initialPosts: MarketplaceMediaPost[];
  initialHasMore: boolean;
  phoneVerified: boolean;
  isOldEnough: boolean;
  isAgeVerified: boolean;
  isProfilePublic: boolean;
}

export function MarketplaceClient({
  initialPosts,
  initialHasMore,
  phoneVerified,
  isOldEnough,
  isAgeVerified,
  isProfilePublic,
}: MarketplaceClientProps) {
  const [newPost, setNewPost] = useState<MarketplaceMediaPost | null>(null);

  const handlePostCreated = useCallback(async (postId: string) => {
    const post = await fetchSingleMarketplacePost(postId);
    if (post) setNewPost(post);
  }, []);

  return (
    <>
      <MarketplacePostComposer
        phoneVerified={phoneVerified}
        isOldEnough={isOldEnough}
        isAgeVerified={isAgeVerified}
        isProfilePublic={isProfilePublic}
        onPostCreated={handlePostCreated}
      />
      <MarketplaceGrid
        initialPosts={initialPosts}
        initialHasMore={initialHasMore}
        newPost={newPost}
      />
    </>
  );
}
