"use client";

import Link from "next/link";

export type ExploreTab = "tags" | "random";

interface ExploreViewToggleProps {
  activeTab: ExploreTab;
  hasCustomTheme?: boolean;
}

const TABS: { tab: ExploreTab; label: string; href: string; icon: React.ReactNode }[] = [
  {
    tab: "tags",
    label: "Tags",
    href: "/explore",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
      </svg>
    ),
  },
  {
    tab: "random",
    label: "Random",
    href: "/explore?view=random",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
      </svg>
    ),
  },
];

const activeTabStyle: React.CSSProperties = {
  color: "var(--profile-bg, #fff)",
  backgroundColor: "var(--profile-text, #18181b)",
  boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
};

const inactiveTabStyle: React.CSSProperties = {
  color: "var(--profile-text, #18181b)",
  backgroundColor: "color-mix(in srgb, var(--profile-secondary, #71717a) 15%, transparent)",
};

export function ExploreViewToggle({ activeTab, hasCustomTheme }: ExploreViewToggleProps) {
  const baseClass = "px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap";

  return (
    <div className={`mb-4 rounded-xl p-2 ${hasCustomTheme ? "profile-tabs-bar" : "bg-zinc-100 dark:bg-zinc-800"}`}>
      <div
        className="flex gap-2"
        role="tablist"
        aria-label="Explore view"
      >
        {TABS.map(({ tab, label, href, icon }) => (
          <Link
            key={tab}
            href={href}
            role="tab"
            aria-selected={activeTab === tab}
            className={baseClass}
            style={activeTab === tab ? activeTabStyle : inactiveTabStyle}
            data-testid={`explore-view-${tab}`}
          >
            <span className="inline-flex items-center gap-1.5">
              {icon}
              {label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
