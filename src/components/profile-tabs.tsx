"use client";

import Link from "next/link";

interface ProfileTabsProps {
  username: string;
  activeTab: "posts" | "reposts" | "nsfw";
  hasCustomTheme: boolean;
  showNsfwTab: boolean;
}

export function ProfileTabs({ username, activeTab, hasCustomTheme, showNsfwTab }: ProfileTabsProps) {
  const baseClass = "px-4 py-2 text-sm font-medium border-b-2 transition-colors";

  const activeClass = hasCustomTheme
    ? "border-current"
    : "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100";

  const inactiveClass = hasCustomTheme
    ? "border-transparent opacity-60 hover:opacity-100"
    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300";

  return (
    <div className={`mt-6 flex border-b ${hasCustomTheme ? "border-current opacity-20" : "border-zinc-200 dark:border-zinc-700"}`} style={hasCustomTheme ? { borderColor: "var(--profile-secondary)" } : undefined}>
      <div className="flex" style={hasCustomTheme ? { position: "relative", top: "1px" } : undefined}>
        <Link
          href={`/${username}`}
          className={`${baseClass} ${activeTab === "posts" ? activeClass : inactiveClass}`}
        >
          Posts
        </Link>
        <Link
          href={`/${username}?tab=reposts`}
          className={`${baseClass} ${activeTab === "reposts" ? activeClass : inactiveClass}`}
        >
          Reposts
        </Link>
        {showNsfwTab && (
          <Link
            href={`/${username}?tab=nsfw`}
            className={`${baseClass} ${activeTab === "nsfw" ? activeClass : inactiveClass}`}
          >
            NSFW
          </Link>
        )}
      </div>
    </div>
  );
}
