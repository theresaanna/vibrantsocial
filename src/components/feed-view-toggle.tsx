"use client";

export type FeedView = "posts" | "media";

interface FeedViewToggleProps {
  activeView: FeedView;
  onViewChange: (view: FeedView) => void;
}

export function FeedViewToggle({ activeView, onViewChange }: FeedViewToggleProps) {
  const baseClass = "px-3 py-1.5 rounded-md text-sm font-medium transition-colors";
  const activeClass = "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100";
  const inactiveClass = "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300";

  return (
    <div
      className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
      role="tablist"
      aria-label="Feed view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeView === "posts"}
        className={`${baseClass} ${activeView === "posts" ? activeClass : inactiveClass}`}
        onClick={() => onViewChange("posts")}
        data-testid="feed-view-posts"
      >
        Posts
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeView === "media"}
        className={`${baseClass} ${activeView === "media" ? activeClass : inactiveClass}`}
        onClick={() => onViewChange("media")}
        data-testid="feed-view-media"
      >
        Media
      </button>
    </div>
  );
}
