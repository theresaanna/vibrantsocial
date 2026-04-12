"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

export type CommunitiesView = "tags" | "media" | "discussions" | "newcomers" | "spotlight" | "user-lists" | "chatrooms";

interface CommunitiesViewToggleProps {
  activeView: CommunitiesView;
}

const VIEW_ROUTES: Record<CommunitiesView, string> = {
  tags: "/communities",
  media: "/communities?view=media",
  discussions: "/communities?view=discussions",
  newcomers: "/communities?view=newcomers",
  spotlight: "/communities?view=spotlight",
  "user-lists": "/communities?view=user-lists",
  chatrooms: "/communities/chatrooms",
};

const TABS: { view: CommunitiesView; label: string; testId: string }[] = [
  { view: "tags", label: "Tags", testId: "communities-view-tags" },
  { view: "media", label: "Media", testId: "communities-view-media" },
  { view: "discussions", label: "Discussions", testId: "communities-view-discussions" },
  { view: "newcomers", label: "Newcomers", testId: "communities-view-newcomers" },
  { view: "spotlight", label: "Theme Spotlight", testId: "communities-view-spotlight" },
  { view: "user-lists", label: "User Lists", testId: "communities-view-user-lists" },
  { view: "chatrooms", label: "Chat Rooms", testId: "communities-view-chatrooms" },
];

export function CommunitiesViewToggle({ activeView }: CommunitiesViewToggleProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (view: CommunitiesView) => {
    if (view === "chatrooms") return pathname.startsWith("/communities/chatrooms");
    return activeView === view;
  };

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
      className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
      role="tablist"
      aria-label="Communities view"
    >
      {TABS.map(({ view, label, testId }) =>
        view === "chatrooms" ? (
          <Link
            key={view}
            href={VIEW_ROUTES[view]}
            role="tab"
            aria-selected={isActive(view)}
            className={`${baseClass} ${isActive(view) ? activeClass : inactiveClass} whitespace-nowrap`}
            data-testid={testId}
          >
            {label}
          </Link>
        ) : (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={isActive(view)}
            className={`${baseClass} ${isActive(view) ? activeClass : inactiveClass} whitespace-nowrap`}
            onClick={() => handleViewChange(view)}
            data-testid={testId}
          >
            {label}
          </button>
        )
      )}
    </div>
  );
}
