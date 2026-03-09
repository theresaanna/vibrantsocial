"use client";

import Link from "next/link";

interface ProfileTabsProps {
  username: string;
  activeTab: "posts" | "reposts" | "sensitive" | "nsfw" | "graphic";
  hasCustomTheme: boolean;
  showSensitiveTab: boolean;
  showNsfwTab: boolean;
  showGraphicTab: boolean;
}

export function ProfileTabs({ username, activeTab, hasCustomTheme, showSensitiveTab, showNsfwTab, showGraphicTab }: ProfileTabsProps) {
  const baseClass = "px-2 sm:px-4 py-2 text-sm font-medium border-b-2 transition-colors";

  const activeClass = hasCustomTheme
    ? "border-current"
    : "border-fuchsia-600 text-zinc-800 dark:border-fuchsia-400 dark:text-white";

  const inactiveClass = hasCustomTheme
    ? "border-transparent opacity-60 hover:opacity-100"
    : "border-transparent text-zinc-500 hover:text-fuchsia-600 dark:text-zinc-400 dark:hover:text-fuchsia-400";

  const tabStyle = (isActive: boolean): React.CSSProperties | undefined => {
    if (!hasCustomTheme) return undefined;
    return isActive
      ? { color: "var(--profile-text)", borderColor: "var(--profile-secondary)" }
      : undefined;
  };

  return (
    <div className={`mt-6 flex border-b ${hasCustomTheme ? "" : "border-zinc-200 dark:border-zinc-700"}`} style={hasCustomTheme ? { borderColor: "color-mix(in srgb, var(--profile-secondary) 20%, transparent)" } : undefined}>
      <div className="-ml-[5px] sm:ml-0 flex" style={hasCustomTheme ? { position: "relative", top: "1px" } : undefined}>
        <Link
          href={`/${username}`}
          className={`${baseClass} ${activeTab === "posts" ? activeClass : inactiveClass}`}
          style={tabStyle(activeTab === "posts")}
        >
          Posts
        </Link>
        <Link
          href={`/${username}?tab=reposts`}
          className={`${baseClass} ${activeTab === "reposts" ? activeClass : inactiveClass}`}
          style={tabStyle(activeTab === "reposts")}
        >
          Reposts
        </Link>
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
