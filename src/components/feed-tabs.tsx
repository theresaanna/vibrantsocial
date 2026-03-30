"use client";

import Link from "next/link";

interface ListTab {
  id: string;
  name: string;
  ownerUsername?: string | null;
}

export function FeedTabs({ lists, activeListId, activeListInfo }: {
  lists: ListTab[];
  activeListId?: string;
  activeListInfo?: ListTab | null;
}) {
  const baseClass = "px-3 py-1.5 rounded-md text-sm font-medium transition-colors";
  const activeClass = "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100";
  const inactiveClass = "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300";

  // If the active list isn't in the tabs (viewing someone else's unsubscribed list), show it
  const showActiveAsExtra = activeListId && activeListInfo && !lists.some((l) => l.id === activeListId);

  function tabLabel(list: ListTab) {
    if (list.ownerUsername) {
      return `${list.ownerUsername}: ${list.name}`;
    }
    return list.name;
  }

  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
      <Link
        href="/feed"
        prefetch={false}
        className={`${baseClass} ${!activeListId ? activeClass : inactiveClass} shrink-0`}
      >
        Feed
      </Link>
      <Link
        href="/feed?list=close-friends"
        prefetch={false}
        className={`${baseClass} ${activeListId === "close-friends" ? activeClass : inactiveClass} shrink-0`}
      >
        Close Friends
      </Link>
      {lists.map((list) => (
        <Link
          key={list.id}
          href={`/feed?list=${list.id}`}
          prefetch={false}
          className={`${baseClass} ${activeListId === list.id ? activeClass : inactiveClass} shrink-0`}
        >
          {tabLabel(list)}
        </Link>
      ))}
      {showActiveAsExtra && (
        <Link
          href={`/feed?list=${activeListInfo.id}`}
          className={`${baseClass} ${activeClass} shrink-0`}
        >
          {tabLabel(activeListInfo)}
        </Link>
      )}
      <Link
        href="/lists"
        className={`${baseClass} ${inactiveClass} shrink-0`}
        title="Manage lists"
      >
        +
      </Link>
    </div>
  );
}
