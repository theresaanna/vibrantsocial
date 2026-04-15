"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { MarketplacePostComposer } from "@/components/marketplace-post-composer";

interface MarketplaceComposeClientProps {
  phoneVerified: boolean;
  isOldEnough: boolean;
  isAgeVerified: boolean;
  isProfilePublic: boolean;
}

export function MarketplaceComposeClient({
  phoneVerified,
  isOldEnough,
  isAgeVerified,
  isProfilePublic,
}: MarketplaceComposeClientProps) {
  const router = useRouter();

  const handlePostCreated = useCallback(
    (postId: string) => {
      router.push(`/marketplace/${postId}`);
    },
    [router],
  );

  return (
    <MarketplacePostComposer
      phoneVerified={phoneVerified}
      isOldEnough={isOldEnough}
      isAgeVerified={isAgeVerified}
      isProfilePublic={isProfilePublic}
      onPostCreated={handlePostCreated}
    />
  );
}
