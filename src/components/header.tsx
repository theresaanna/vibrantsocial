import { auth } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { getConversations } from "@/app/chat/actions";
import { getUnreadNotificationCount, getRecentNotifications, getLinkedAccountNotificationCounts } from "@/app/notifications/actions";
import { ChatNav } from "@/components/chat-nav";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLinks, MobileProfileLink } from "@/components/nav-links";
import { AccountSwitcherWrapper } from "@/components/account-switcher-wrapper";
import { loadLinkedAccounts } from "@/lib/account-linking-db";

export async function Header() {
  const session = await auth();
  const [conversations, unreadNotifications, recentNotifications, linkedAccounts, linkedAccountNotifCounts] = await Promise.all([
    session?.user ? getConversations() : Promise.resolve([]),
    session?.user ? getUnreadNotificationCount() : Promise.resolve(0),
    session?.user ? getRecentNotifications() : Promise.resolve([]),
    session?.user?.id ? loadLinkedAccounts(session.user.id) : Promise.resolve([]),
    session?.user ? getLinkedAccountNotificationCounts() : Promise.resolve({}),
  ]);

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-2 py-3 sm:px-4">
        <Link
          href="/"
        >
          <Image
            src="/vibrantsocial-logo.png"
            alt="VibrantSocial"
            width={160}
            height={40}
            priority
          />
        </Link>

        {/* Mobile-only profile link + theme toggle next to logo */}
        {session?.user && (
          <div className="order-2 flex items-center gap-1 sm:hidden">
            <AccountSwitcherWrapper initialLinkedAccounts={linkedAccounts} initialNotificationCounts={linkedAccountNotifCounts} />
            <ThemeToggle />
            <MobileProfileLink username={session.user.username} />
          </div>
        )}

        <div className="order-3 flex w-full items-center justify-between border-t border-zinc-100 pt-2 sm:order-2 sm:flex-1 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0 dark:border-zinc-800">
          <div className="hidden sm:inline-flex"><ThemeToggle /></div>
          {session?.user ? (
            <>
              <DynamicFavicon
                initialHasUnread={
                  unreadNotifications > 0 ||
                  conversations.some((c: { unreadCount: number }) => c.unreadCount > 0)
                }
              />
              <NavLinks username={session.user.username} />
              <div className="hidden sm:inline-flex"><AccountSwitcherWrapper initialLinkedAccounts={linkedAccounts} initialNotificationCounts={linkedAccountNotifCounts} /></div>
              <NotificationBell initialUnreadCount={unreadNotifications} initialNotifications={recentNotifications} />
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
