"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { PostComposer } from "@/components/post-composer";

interface ComposeClientProps {
  phoneVerified: boolean;
  isOldEnough: boolean;
  isPremium: boolean;
}

export function ComposeClient({ phoneVerified, isOldEnough, isPremium }: ComposeClientProps) {
  const router = useRouter();

  const handlePostCreated = useCallback(() => {
    router.push("/feed");
  }, [router]);

  return (
    <PostComposer
      phoneVerified={phoneVerified}
      isOldEnough={isOldEnough}
      isPremium={isPremium}
      onPostCreated={handlePostCreated}
    />
  );
}
