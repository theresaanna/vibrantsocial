"use client";

export type FeedView = "posts" | "media";

interface FeedViewToggleProps {
  activeView: FeedView;
  onViewChange: (view: FeedView) => void;
}

export function FeedViewToggle({ activeView, onViewChange }: FeedViewToggleProps) {
  const baseClass = "flex-1 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all text-center";
  const activeClass = "bg-fuchsia-600 text-white shadow-md dark:bg-fuchsia-500";
  const inactiveClass = "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200";

  return (
    <div
      className="mb-4 flex gap-2"
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
        <span className="inline-flex items-center justify-center gap-1.5">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          Full Post View
        </span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeView === "media"}
        className={`${baseClass} ${activeView === "media" ? activeClass : inactiveClass}`}
        onClick={() => onViewChange("media")}
        data-testid="feed-view-media"
      >
        <span className="inline-flex items-center justify-center gap-1.5">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
          </svg>
          Media View
        </span>
      </button>
    </div>
  );
}
