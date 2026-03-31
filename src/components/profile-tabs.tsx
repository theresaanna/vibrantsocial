"use client";

import Link from "next/link";

interface ProfileTabsProps {
  username: string;
  activeTab: "posts" | "wall" | "sensitive" | "nsfw" | "graphic";
  hasCustomTheme: boolean;
  showWallTab: boolean;
  showSensitiveTab: boolean;
  showNsfwTab: boolean;
  showGraphicTab: boolean;
}

export function ProfileTabs({ username, activeTab, hasCustomTheme, showWallTab, showSensitiveTab, showNsfwTab, showGraphicTab }: ProfileTabsProps) {
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

  return (
    <div className="mt-6">
      <div className="flex gap-2 overflow-x-auto">
        <Link
          href={`/${username}`}
          className={`${baseClass} ${activeTab === "posts" ? activeClass : inactiveClass}`}
          style={tabStyle(activeTab === "posts")}
        >
          Posts
        </Link>
        {showWallTab && (
          <Link
            href={`/${username}?tab=wall`}
            className={`${baseClass} ${activeTab === "wall" ? activeClass : inactiveClass}`}
            style={tabStyle(activeTab === "wall")}
          >
            Wall
          </Link>
        )}
        {showSensitiveTab && (
          <Link
            href={`/${username}?tab=sensitive`}
            className={`${baseClass} ${activeTab === "sensitive" ? activeClass : inactiveClass}`}
            style={tabStyle(activeTab === "sensitive")}
          >
            Sensitive
          </Link>
        )}
        {showNsfwTab && (
          <Link
            href={`/${username}?tab=nsfw`}
            className={`${baseClass} ${activeTab === "nsfw" ? activeClass : inactiveClass}`}
            style={tabStyle(activeTab === "nsfw")}
          >
            NSFW
          </Link>
        )}
        {showGraphicTab && (
          <Link
            href={`/${username}?tab=graphic`}
            className={`${baseClass} ${activeTab === "graphic" ? activeClass : inactiveClass}`}
            style={tabStyle(activeTab === "graphic")}
          >
            Graphic/Explicit
          </Link>
        )}
      </div>
    </div>
  );
}
