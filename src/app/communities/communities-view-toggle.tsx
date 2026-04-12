"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -120 : 120, behavior: "smooth" });
  };

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

  const arrowClass =
    "absolute top-0 bottom-0 z-10 flex w-7 items-center justify-center text-zinc-500 dark:text-zinc-400";

  return (
    <div className="relative mb-4">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className={`${arrowClass} left-0 rounded-l-lg bg-gradient-to-r from-zinc-100 via-zinc-100 to-transparent dark:from-zinc-800 dark:via-zinc-800`}
          aria-label="Scroll tabs left"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-1 scrollbar-none dark:bg-zinc-800"
        role="tablist"
        aria-label="Communities view"
        style={{ scrollbarWidth: "none" }}
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

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className={`${arrowClass} right-0 rounded-r-lg bg-gradient-to-l from-zinc-100 via-zinc-100 to-transparent dark:from-zinc-800 dark:via-zinc-800`}
          aria-label="Scroll tabs right"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
