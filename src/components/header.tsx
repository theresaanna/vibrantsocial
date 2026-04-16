import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { NsfwToggle } from "@/components/nsfw-toggle";
import { HeaderAuth } from "@/components/header-auth";

/**
 * Skeleton placeholder for the authenticated header controls.
 * Matches the layout of NavLinks + action icons so there's no CLS
 * when the real content streams in.
 */
function HeaderAuthSkeleton() {
  return (
    <div className="flex items-center gap-1">
      {/* Nav links skeleton */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-8 w-8 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      ))}
      {/* Action icons skeleton */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={`action-${i}`} className="h-8 w-8 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      ))}
    </div>
  );
}

export function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <nav className="mx-auto flex max-w-3xl items-center gap-2 overflow-x-auto px-2 py-3 scrollbar-none sm:px-4" style={{ scrollbarWidth: "none" }}>
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <Image
            src="/vibrantsocial-logo.png"
            alt="VibrantSocial"
            width={160}
            height={40}
            priority
          />
        </Link>

        {/* Theme toggle, NSFW toggle, Help — grouped together */}
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <NsfwToggle />
          <Link
            href="/help"
            className="rounded-lg p-1 text-zinc-600 transition-colors hover:bg-fuchsia-50 hover:text-fuchsia-500 sm:p-1.5 dark:text-zinc-400 dark:hover:bg-fuchsia-900/20 dark:hover:text-fuchsia-400"
            aria-label="Help"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </Link>
        </div>

        {/* Spacer pushes nav + actions to the right */}
        <div className="flex-1" />

        {/* Auth-dependent parts stream in via Suspense */}
        <Suspense fallback={<HeaderAuthSkeleton />}>
          <HeaderAuth />
        </Suspense>
      </nav>
    </header>
  );
}
