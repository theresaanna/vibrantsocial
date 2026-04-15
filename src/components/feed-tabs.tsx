"use client";

import Link from "next/link";

interface ListTab {
  id: string;
  name: string;
  ownerUsername?: string | null;
}

export function FeedTabs({ lists, activeListId, activeListInfo, hasCustomTheme = false }: {
  lists: ListTab[];
  activeListId?: string;
  activeListInfo?: ListTab | null;
  hasCustomTheme?: boolean;
}) {
  const baseClass = "shrink-0 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all";

  const activeClass = hasCustomTheme
    ? ""
    : "bg-fuchsia-600 text-white shadow-md dark:bg-fuchsia-500";

  const inactiveClass = hasCustomTheme
    ? "opacity-60 hover:opacity-100"
    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200";

  const tabStyle = (isActive: boolean): React.CSSProperties | undefined => {
    if (!hasCustomTheme) return undefined;
    return isActive
      ? {
          color: "var(--profile-bg, #fff)",
          backgroundColor: "var(--profile-text, #18181b)",
          boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        }
      : {
          color: "var(--profile-text)",
          backgroundColor: "color-mix(in srgb, var(--profile-secondary) 15%, transparent)",
        };
  };

  // If the active list isn't in the tabs (viewing someone else's unsubscribed list), show it
  const showActiveAsExtra = activeListId && activeListInfo && !lists.some((l) => l.id === activeListId);

  function tabLabel(list: ListTab) {
    if (list.ownerUsername) {
      return `${list.ownerUsername}: ${list.name}`;
    }
    return list.name;
  }

  return (
    <div className={`mb-4 flex gap-2 overflow-x-auto${hasCustomTheme ? " profile-tabs-bar" : ""}`}>
      <Link
        href="/feed"
        prefetch={false}
        className={`${baseClass} ${!activeListId ? activeClass : inactiveClass}`}
        style={tabStyle(!activeListId)}
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
        className={`${baseClass} ${activeListId === "for-you" ? activeClass : inactiveClass}`}
        style={tabStyle(activeListId === "for-you")}
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
        className={`${baseClass} ${activeListId === "close-friends" ? activeClass : inactiveClass}`}
        style={tabStyle(activeListId === "close-friends")}
      >
        Close Friends
      </Link>
      <Link
        href="/feed?list=likes"
        prefetch={false}
        className={`${baseClass} ${activeListId === "likes" ? activeClass : inactiveClass}`}
        style={tabStyle(activeListId === "likes")}
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
        className={`${baseClass} ${activeListId === "bookmarks" ? activeClass : inactiveClass}`}
        style={tabStyle(activeListId === "bookmarks")}
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
          className={`${baseClass} ${activeListId === list.id ? activeClass : inactiveClass}`}
          style={tabStyle(activeListId === list.id)}
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
          className={`${baseClass} ${activeClass}`}
          style={tabStyle(true)}
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
        className={`${baseClass} ${inactiveClass}`}
        style={tabStyle(false)}
        title="Manage lists"
      >
        +
      </Link>
    </div>
  );
}
