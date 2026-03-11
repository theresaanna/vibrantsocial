import { auth } from "@/auth";
import Link from "next/link";
import { getConversations } from "@/app/chat/actions";
import { getUnreadNotificationCount } from "@/app/notifications/actions";
import { ChatNav } from "@/components/chat-nav";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { NotificationBell } from "@/components/notification-bell";
import { SearchBar } from "@/components/search-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLinks, MobileProfileLink } from "@/components/nav-links";

export async function Header() {
  const session = await auth();
  const [conversations, unreadNotifications] = await Promise.all([
    session?.user ? getConversations() : Promise.resolve([]),
    session?.user ? getUnreadNotificationCount() : Promise.resolve(0),
  ]);

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-2 py-3 sm:px-4">
        <Link
          href="/"
          className="text-lg font-bold"
        >
          <span className="text-fuchsia-600 dark:text-fuchsia-400">Vibrant</span>
          <span className="text-blue-600 dark:text-blue-400">Social</span>
        </Link>

        {/* Mobile-only profile link + theme toggle next to logo */}
        {session?.user && (
          <div className="order-2 flex items-center gap-1 sm:hidden">
            <ThemeToggle />
            <MobileProfileLink username={session.user.username} />
          </div>
        )}

        <div className="order-3 flex w-full items-center justify-between border-t border-zinc-100 pt-2 sm:order-2 sm:w-auto sm:justify-start sm:gap-4 sm:border-0 sm:pt-0 dark:border-zinc-800">
          <div className="hidden sm:block"><ThemeToggle /></div>
          {session?.user ? (
            <>
              <DynamicFavicon
                initialHasUnread={
                  unreadNotifications > 0 ||
                  conversations.some((c: { unreadCount: number }) => c.unreadCount > 0)
                }
              />
              <SearchBar />
              <NavLinks username={session.user.username} />
              <NotificationBell initialUnreadCount={unreadNotifications} />
              <ChatNav initialConversations={conversations} />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:from-fuchsia-500 hover:to-blue-500"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
