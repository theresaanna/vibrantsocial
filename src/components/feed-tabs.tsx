"use client";

import Link from "next/link";

interface ListSummary {
  id: string;
  name: string;
}

export function FeedTabs({ lists, activeListId }: { lists: ListSummary[]; activeListId?: string }) {

  const baseClass = "px-3 py-1.5 rounded-md text-sm font-medium transition-colors";
  const activeClass = "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100";
  const inactiveClass = "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300";

  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
      <Link
        href="/feed"
        className={`${baseClass} ${!activeListId ? activeClass : inactiveClass} shrink-0`}
      >
        Feed
      </Link>
      {lists.map((list) => (
        <Link
          key={list.id}
          href={`/feed?list=${list.id}`}
          className={`${baseClass} ${activeListId === list.id ? activeClass : inactiveClass} shrink-0`}
        >
          {list.name}
        </Link>
      ))}
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
