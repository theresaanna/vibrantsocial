"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { FeedViewToggle, type FeedView } from "./feed-view-toggle";

interface FeedViewToggleWrapperProps {
  activeView: FeedView;
}

export function FeedViewToggleWrapper({ activeView }: FeedViewToggleWrapperProps) {
  const router = useRouter();

  const handleViewChange = useCallback(
    (view: FeedView) => {
      if (view === "media") {
        router.push("/feed?view=media");
      } else {
        router.push("/feed");
      }
    },
    [router]
  );

  return (
    <FeedViewToggle activeView={activeView} onViewChange={handleViewChange} />
  );
}
