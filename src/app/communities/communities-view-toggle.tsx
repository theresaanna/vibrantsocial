"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export type CommunitiesView = "tags" | "media" | "discussions" | "newcomers" | "spotlight" | "user-lists" | "chatrooms";

interface CommunitiesViewToggleProps {
  activeView: CommunitiesView;
  hasCustomTheme?: boolean;
}

const VIEW_ROUTES: Record<CommunitiesView, string> = {
  tags: "/communities",
  media: "/communities?view=media",
  discussions: "/communities?view=discussions",
  newcomers: "/communities?view=newcomers",
  spotlight: "/communities?view=spotlight",
  "user-lists": "/lists?view=everyone",
  chatrooms: "/communities/chatrooms",
};

const TABS: { view: CommunitiesView; label: string; testId: string }[] = [
  { view: "tags", label: "Tags", testId: "communities-view-tags" },
  { view: "newcomers", label: "Newcomers", testId: "communities-view-newcomers" },
  { view: "spotlight", label: "Theme Spotlight", testId: "communities-view-spotlight" },
  { view: "user-lists", label: "User Lists", testId: "communities-view-user-lists" },
  { view: "chatrooms", label: "Chat Rooms", testId: "communities-view-chatrooms" },
];

export function CommunitiesViewToggle({ activeView, hasCustomTheme }: CommunitiesViewToggleProps) {
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

  const baseClass = "px-5 py-2.5 rounded-lg text-sm font-semibold transition-all";
  const activeTabStyle: React.CSSProperties = {
    color: "var(--profile-bg, #fff)",
    backgroundColor: "var(--profile-text, #18181b)",
    boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  };
  const inactiveTabStyle: React.CSSProperties = {
    color: "var(--profile-text, #18181b)",
    backgroundColor: "color-mix(in srgb, var(--profile-secondary, #71717a) 15%, transparent)",
  };

  const arrowClass =
    "absolute top-0 bottom-0 z-10 flex w-7 items-center justify-center";

  return (
    <div className={`relative mb-4 rounded-xl p-2 ${hasCustomTheme ? "profile-tabs-bar" : "bg-zinc-100 dark:bg-zinc-800"}`}>
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className={`${arrowClass} left-0 rounded-l-lg`}
          style={{ color: "var(--profile-text, #18181b)" }}
          aria-label="Scroll tabs left"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-none"
        role="tablist"
        aria-label="Communities view"
        style={{ scrollbarWidth: "none" }}
      >
        {TABS.map(({ view, label, testId }) =>
          view === "chatrooms" || view === "user-lists" ? (
            <Link
              key={view}
              href={VIEW_ROUTES[view]}
              role="tab"
              aria-selected={isActive(view)}
              className={`${baseClass} whitespace-nowrap`}
              style={isActive(view) ? activeTabStyle : inactiveTabStyle}
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
              className={`${baseClass} whitespace-nowrap`}
              style={isActive(view) ? activeTabStyle : inactiveTabStyle}
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
          className={`${arrowClass} right-0 rounded-r-lg`}
          style={{ color: "var(--profile-text, #18181b)" }}
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
