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
    <>
      {/* Nav links skeleton — row 2 on mobile, row 2 col 2 right-aligned on md+ */}
      <div className="order-3 flex w-full items-center justify-end gap-1 border-t border-zinc-100 pl-2 pt-2 md:order-none md:col-start-2 md:row-start-2 md:w-auto md:justify-self-end md:self-center md:border-0 md:pl-0 md:pt-0 dark:border-zinc-800">
        {/* 5 icon placeholders matching NavLinks */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-8 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
      {/* Action icons skeleton — row 1 right on mobile, row 2 col 3 on md+ */}
      <div className="order-2 ml-auto flex shrink-0 items-center gap-1 md:order-none md:col-start-3 md:row-start-2 md:ml-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-8 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    </>
  );
}

export function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      {/*
        Mobile: flex-wrap — logo+toggles row 1 left, action icons row 1 right,
        nav links row 2 (full width).
        Desktop (md+): 2-row, 3-col CSS grid — logo+toggles row 1 col 1,
        nav links row 2 col 2 (right-aligned within col 2), action icons
        row 2 col 3. Together this puts nav links and action icons side-by-side
        as a single group on the right edge of row 2.
      */}
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-2 py-3 sm:px-4 md:grid md:grid-cols-[auto_1fr_auto] md:gap-x-2 md:gap-y-2">
        {/* Logo + theme toggles — renders immediately, no data needed */}
        <div className="flex shrink-0 items-center gap-2 md:col-start-1 md:row-start-1 md:self-center">
          <Link href="/">
            <Image
              src="/vibrantsocial-logo.png"
              alt="VibrantSocial"
              width={160}
              height={40}
              priority
            />
          </Link>
          <ThemeToggle />
          <NsfwToggle />
        </div>

        {/* Auth-dependent parts stream in via Suspense */}
        <Suspense fallback={<HeaderAuthSkeleton />}>
          <HeaderAuth />
        </Suspense>
      </nav>
    </header>
  );
}
