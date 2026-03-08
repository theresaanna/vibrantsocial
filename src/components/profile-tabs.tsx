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
    : "border-fuchsia-500 text-fuchsia-600 dark:border-fuchsia-400 dark:text-fuchsia-400";

  const inactiveClass = hasCustomTheme
    ? "border-transparent opacity-60 hover:opacity-100"
    : "border-transparent text-zinc-600 hover:text-fuchsia-500 dark:text-zinc-400 dark:hover:text-fuchsia-400";

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
