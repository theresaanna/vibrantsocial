"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export type CommunitiesView = "tags" | "media";

interface CommunitiesViewToggleProps {
  activeView: CommunitiesView;
}

export function CommunitiesViewToggle({ activeView }: CommunitiesViewToggleProps) {
  const router = useRouter();

  const handleViewChange = useCallback(
    (view: CommunitiesView) => {
      if (view === "media") {
        router.push("/communities?view=media");
      } else {
        router.push("/communities");
      }
    },
    [router]
  );

  const baseClass = "px-3 py-1.5 rounded-md text-sm font-medium transition-colors";
  const activeClass = "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100";
  const inactiveClass = "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300";

  return (
    <div
      className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
      role="tablist"
      aria-label="Communities view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeView === "tags"}
        className={`${baseClass} ${activeView === "tags" ? activeClass : inactiveClass}`}
        onClick={() => handleViewChange("tags")}
        data-testid="communities-view-tags"
      >
        Tags
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeView === "media"}
        className={`${baseClass} ${activeView === "media" ? activeClass : inactiveClass}`}
        onClick={() => handleViewChange("media")}
        data-testid="communities-view-media"
      >
        Media
      </button>
    </div>
  );
}
