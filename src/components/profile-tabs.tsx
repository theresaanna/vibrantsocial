"use client";

import Link from "next/link";

interface ProfileTabsProps {
  username: string;
  activeTab: "posts" | "media" | "wall" | "sensitive" | "nsfw" | "graphic" | "marketplace";
  hasCustomTheme: boolean;
  showMediaTab: boolean;
  showWallTab: boolean;
  showSensitiveTab: boolean;
  showNsfwTab: boolean;
  showGraphicTab: boolean;
  showMarketplaceTab: boolean;
}

export function ProfileTabs({ username, activeTab, hasCustomTheme, showMediaTab, showWallTab, showSensitiveTab, showNsfwTab, showGraphicTab, showMarketplaceTab }: ProfileTabsProps) {
  const baseClass = "px-5 py-2.5 rounded-lg text-sm font-semibold transition-all";

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
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${username}`}
          className={`${baseClass} ${activeTab === "posts" ? activeClass : inactiveClass}`}
          style={tabStyle(activeTab === "posts")}
        >
          Posts
        </Link>
        {showMediaTab && (
          <Link
            href={`/${username}?tab=media`}
            className={`${baseClass} ${activeTab === "media" ? activeClass : inactiveClass}`}
            style={tabStyle(activeTab === "media")}
          >
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
              </svg>
              Media
            </span>
          </Link>
        )}
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
        {showMarketplaceTab && (
          <Link
            href={`/${username}?tab=marketplace`}
            className={`${baseClass} ${activeTab === "marketplace" ? activeClass : inactiveClass}`}
            style={tabStyle(activeTab === "marketplace")}
            data-testid="profile-marketplace-tab"
          >
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0020.01 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
              Marketplace
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
