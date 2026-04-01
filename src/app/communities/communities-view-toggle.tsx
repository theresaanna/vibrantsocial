"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export type CommunitiesView = "tags" | "media" | "discussions" | "newcomers";

interface CommunitiesViewToggleProps {
  activeView: CommunitiesView;
}

const VIEW_ROUTES: Record<CommunitiesView, string> = {
  tags: "/communities",
  media: "/communities?view=media",
  discussions: "/communities?view=discussions",
  newcomers: "/communities?view=newcomers",
};

const TABS: { view: CommunitiesView; label: string; testId: string }[] = [
  { view: "tags", label: "Tags", testId: "communities-view-tags" },
  { view: "media", label: "Media", testId: "communities-view-media" },
  { view: "discussions", label: "Discussions", testId: "communities-view-discussions" },
  { view: "newcomers", label: "Newcomers", testId: "communities-view-newcomers" },
];

export function CommunitiesViewToggle({ activeView }: CommunitiesViewToggleProps) {
  const router = useRouter();

  const handleViewChange = useCallback(
    (view: CommunitiesView) => {
      router.push(VIEW_ROUTES[view]);
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
      {TABS.map(({ view, label, testId }) => (
        <button
          key={view}
          type="button"
          role="tab"
          aria-selected={activeView === view}
          className={`${baseClass} ${activeView === view ? activeClass : inactiveClass}`}
          onClick={() => handleViewChange(view)}
          data-testid={testId}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
