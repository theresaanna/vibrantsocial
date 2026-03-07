import { auth } from "@/auth";
import Link from "next/link";
import { getConversations } from "@/app/chat/actions";
import { getUnreadNotificationCount } from "@/app/notifications/actions";
import { ChatNav } from "@/components/chat-nav";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { NotificationBell } from "@/components/notification-bell";
import { SearchBar } from "@/components/search-bar";
import { ThemeToggle } from "@/components/theme-toggle";

export async function Header() {
  const session = await auth();
  const [conversations, unreadNotifications] = await Promise.all([
    session?.user ? getConversations() : Promise.resolve([]),
    session?.user ? getUnreadNotificationCount() : Promise.resolve(0),
  ]);

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link
          href="/"
          className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
        >
          VibrantSocial
        </Link>

        <div className="order-3 flex w-full items-center justify-between border-t border-zinc-100 pt-2 sm:order-2 sm:w-auto sm:justify-start sm:gap-4 sm:border-0 sm:pt-0 dark:border-zinc-800">
          <ThemeToggle />
          {session?.user ? (
            <>
              <DynamicFavicon
                initialHasUnread={
                  unreadNotifications > 0 ||
                  conversations.some((c: { unreadCount: number }) => c.unreadCount > 0)
                }
              />
              <SearchBar />
              <Link
                href="/feed"
                className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-purple-50 hover:text-purple-500 dark:text-zinc-400 dark:hover:bg-purple-900/20 dark:hover:text-purple-500"
                aria-label="Feed"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                  />
                </svg>
              </Link>
              <Link
                href="/likes"
                className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-zinc-400 dark:hover:bg-red-900/20 dark:hover:text-red-500"
                aria-label="Likes"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                  />
                </svg>
              </Link>
              <Link
                href="/bookmarks"
                className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-yellow-50 hover:text-yellow-500 dark:text-zinc-400 dark:hover:bg-yellow-900/20 dark:hover:text-yellow-500"
                aria-label="Bookmarks"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                  />
                </svg>
              </Link>
              <Link
                href="/communities"
                className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-emerald-50 hover:text-emerald-500 dark:text-zinc-400 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-500"
                aria-label="Communities"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5"
                  />
                </svg>
              </Link>
              <NotificationBell initialUnreadCount={unreadNotifications} />
              <ChatNav initialConversations={conversations} />
              <Link
                href={session.user.username ? `/${session.user.username}` : "/profile"}
                className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-orange-50 hover:text-orange-500 dark:text-zinc-400 dark:hover:bg-orange-900/20 dark:hover:text-orange-500"
                aria-label="Profile"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
