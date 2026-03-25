"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "@/components/tooltip";

interface NavLink {
  href: string;
  label: string;
  color: string;
  activeColor: string;
  icon: React.ReactNode;
  matchPrefix?: boolean;
}

export function NavLinks({ username }: { username?: string | null }) {
  const pathname = usePathname();

  const profileHref = username ? `/${username}` : "/profile";

  const links: NavLink[] = [
    {
      href: "/search",
      label: "Search",
      matchPrefix: true,
      color: "hover:bg-teal-50 hover:text-teal-500 dark:hover:bg-teal-900/20 dark:hover:text-teal-500",
      activeColor: "bg-teal-50 text-teal-500 dark:bg-teal-900/20 dark:text-teal-500",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      ),
    },
    {
      href: "/feed",
      label: "Home",
      color: "hover:bg-purple-50 hover:text-purple-500 dark:hover:bg-purple-900/20 dark:hover:text-purple-500",
      activeColor: "bg-purple-50 text-purple-500 dark:bg-purple-900/20 dark:text-purple-500",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      href: "/compose",
      label: "Compose",
      color: "hover:bg-cyan-50 hover:text-cyan-500 dark:hover:bg-cyan-900/20 dark:hover:text-cyan-500",
      activeColor: "bg-cyan-50 text-cyan-500 dark:bg-cyan-900/20 dark:text-cyan-500",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      ),
    },
    {
      href: "/likes",
      label: "Likes",
      color: "hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-500",
      activeColor: "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-500",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      ),
    },
    {
      href: "/bookmarks",
      label: "Bookmarks",
      color: "hover:bg-yellow-50 hover:text-yellow-500 dark:hover:bg-yellow-900/20 dark:hover:text-yellow-500",
      activeColor: "bg-yellow-50 text-yellow-500 dark:bg-yellow-900/20 dark:text-yellow-500",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
        </svg>
      ),
    },
    {
      href: "/lists",
      label: "Lists",
      matchPrefix: true,
      color: "hover:bg-indigo-50 hover:text-indigo-500 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-500",
      activeColor: "bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-500",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      ),
    },
    {
      href: "/close-friends",
      label: "Close Friends",
      matchPrefix: true,
      color: "hover:bg-green-50 hover:text-green-500 dark:hover:bg-green-900/20 dark:hover:text-green-500",
      activeColor: "bg-green-50 text-green-500 dark:bg-green-900/20 dark:text-green-500",
      icon: (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 0 1 14 0H3.5ZM18 8.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM16.5 13c0-.78.145-1.527.41-2.215A5.98 5.98 0 0 0 13.5 9.75a5.973 5.973 0 0 0-1.958.33A7.02 7.02 0 0 1 17.5 16h4a.5.5 0 0 0 .5-.5 5.5 5.5 0 0 0-5.5-2.5Z" />
        </svg>
      ),
    },
    {
      href: "/marketplace",
      label: "Marketplace",
      matchPrefix: true,
      color: "hover:bg-pink-50 hover:text-pink-500 dark:hover:bg-pink-900/20 dark:hover:text-pink-500",
      activeColor: "bg-pink-50 text-pink-500 dark:bg-pink-900/20 dark:text-pink-500",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
      ),
    },
    {
      href: "/communities",
      label: "Communities",
      matchPrefix: true,
      color: "hover:bg-fuchsia-50 hover:text-fuchsia-500 dark:hover:bg-fuchsia-900/20 dark:hover:text-fuchsia-500",
      activeColor: "bg-fuchsia-50 text-fuchsia-500 dark:bg-fuchsia-900/20 dark:text-fuchsia-500",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
        </svg>
      ),
    },
  ];

  const profileLink: NavLink = {
    href: profileHref,
    label: "Profile",
    color: "hover:bg-orange-50 hover:text-orange-500 dark:hover:bg-orange-900/20 dark:hover:text-orange-500",
    activeColor: "bg-orange-50 text-orange-500 dark:bg-orange-900/20 dark:text-orange-500",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  };

  function isActive(link: NavLink) {
    if (link.matchPrefix) {
      if (pathname.startsWith(link.href)) return true;
      // /tag/* pages should highlight the Communities nav link
      if (link.href === "/communities" && pathname.startsWith("/tag/")) return true;
    }
    return pathname === link.href;
  }

  const baseClass = "rounded-lg p-1.5 transition-colors";
  const inactiveText = "text-zinc-600 dark:text-zinc-400";

  return (
    <>
      {links.map((link) => (
        <Tooltip key={link.href} label={link.label}>
          <Link
            href={link.href}
            className={`${baseClass} ${isActive(link) ? link.activeColor : `${inactiveText} ${link.color}`}`}
            aria-label={link.label}
          >
            {link.icon}
          </Link>
        </Tooltip>
      ))}
      <Tooltip label={profileLink.label}>
        <ProfileLink link={profileLink} isActive={isActive(profileLink)} />
      </Tooltip>
    </>
  );
}

function ProfileLink({ link, isActive, className }: { link: NavLink; isActive: boolean; className?: string }) {
  const baseClass = "rounded-lg p-1.5 transition-colors";
  const inactiveText = "text-zinc-600 dark:text-zinc-400";

  return (
    <Link
      href={link.href}
      className={`${baseClass} ${isActive ? link.activeColor : `${inactiveText} ${link.color}`} ${className ?? ""}`}
      aria-label={link.label}
    >
      {link.icon}
    </Link>
  );
}

