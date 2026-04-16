"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface ListTab {
  id: string;
  name: string;
  ownerUsername?: string | null;
}

const activeStyle: React.CSSProperties = {
  color: "var(--profile-bg, #fff)",
  backgroundColor: "var(--profile-text, #18181b)",
  boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
};

const inactiveStyle: React.CSSProperties = {
  color: "var(--profile-text, #18181b)",
  backgroundColor: "color-mix(in srgb, var(--profile-secondary, #71717a) 15%, transparent)",
};

export function FeedTabs({ lists, activeListId, activeListInfo, hasCustomTheme = false }: {
  lists: ListTab[];
  activeListId?: string;
  activeListInfo?: ListTab | null;
  hasCustomTheme?: boolean;
}) {
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

  const baseClass = "shrink-0 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap";

  // If the active list isn't in the tabs (viewing someone else's unsubscribed list), show it
  const showActiveAsExtra = activeListId && activeListInfo && !lists.some((l) => l.id === activeListId);

  function tabLabel(list: ListTab) {
    if (list.ownerUsername) {
      return `${list.ownerUsername}: ${list.name}`;
    }
    return list.name;
  }

  const arrowClass =
    "absolute top-0 bottom-0 z-10 flex w-7 items-center justify-center";

  return (
    <div className={`relative mb-4 rounded-xl p-2${hasCustomTheme ? " profile-tabs-bar" : " bg-zinc-100 dark:bg-zinc-800"}`}>
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
        style={{ scrollbarWidth: "none" }}
      >
      <Link
        href="/feed"
        prefetch={false}
        className={baseClass}
        style={!activeListId ? activeStyle : inactiveStyle}
      >
        <span className="inline-flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          Feed
        </span>
      </Link>
      <Link
        href="/feed?list=for-you"
        prefetch={false}
        className={baseClass}
        style={activeListId === "for-you" ? activeStyle : inactiveStyle}
      >
        <span className="inline-flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
          </svg>
          Random
        </span>
      </Link>
      <Link
        href="/feed?list=close-friends"
        prefetch={false}
        className={baseClass}
        style={activeListId === "close-friends" ? activeStyle : inactiveStyle}
      >
        <span className="inline-flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          Close Friends
        </span>
      </Link>
      <Link
        href="/feed?list=likes"
        prefetch={false}
        className={baseClass}
        style={activeListId === "likes" ? activeStyle : inactiveStyle}
      >
        <span className="inline-flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          Likes
        </span>
      </Link>
      <Link
        href="/feed?list=bookmarks"
        prefetch={false}
        className={baseClass}
        style={activeListId === "bookmarks" ? activeStyle : inactiveStyle}
      >
        <span className="inline-flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
          Bookmarks
        </span>
      </Link>
      {lists.map((list) => (
        <Link
          key={list.id}
          href={`/feed?list=${list.id}`}
          prefetch={false}
          className={baseClass}
          style={activeListId === list.id ? activeStyle : inactiveStyle}
        >
          <span className="inline-flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            {tabLabel(list)}
          </span>
        </Link>
      ))}
      {showActiveAsExtra && (
        <Link
          href={`/feed?list=${activeListInfo.id}`}
          className={baseClass}
          style={activeStyle}
        >
          <span className="inline-flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            {tabLabel(activeListInfo)}
          </span>
        </Link>
      )}
      <Link
        href="/lists"
        className={baseClass}
        style={inactiveStyle}
        title="Manage lists"
      >
        +
      </Link>
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
