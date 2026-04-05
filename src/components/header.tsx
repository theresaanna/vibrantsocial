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
      {/* Nav links skeleton — row 2 on mobile, inline center on md+ */}
      <div className="order-3 flex w-full items-center justify-end gap-1 border-t border-zinc-100 pl-2 pt-2 md:order-2 md:w-auto md:justify-center md:border-0 md:pl-0 md:pt-0 dark:border-zinc-800">
        {/* 5 icon placeholders matching NavLinks */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-8 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
      {/* Action icons skeleton */}
      <div className="order-2 ml-auto flex shrink-0 items-center gap-1 md:order-3 md:ml-0">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-8 w-8 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    </>
  );
}

export function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-2 py-3 sm:px-4 md:flex-nowrap">
        {/* Logo + theme toggle — renders immediately, no data needed */}
        <div className="flex shrink-0 items-center gap-2">
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
