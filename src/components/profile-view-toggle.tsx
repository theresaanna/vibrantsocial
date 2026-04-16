"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { FeedViewToggle, type FeedView } from "./feed-view-toggle";

interface ProfileViewToggleProps {
  username: string;
  activeView: FeedView;
}

export function ProfileViewToggle({ username, activeView }: ProfileViewToggleProps) {
  const router = useRouter();

  const handleViewChange = useCallback(
    (view: FeedView) => {
      if (view === "media") {
        router.push(`/${username}?view=media`);
      } else {
        router.push(`/${username}`);
      }
    },
    [router, username]
  );

  return (
    <FeedViewToggle activeView={activeView} onViewChange={handleViewChange} />
  );
}
