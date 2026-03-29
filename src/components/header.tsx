import { auth } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { getConversations } from "@/app/chat/actions";
import { getUnreadNotificationCount, getRecentNotifications, getLinkedAccountNotificationCounts } from "@/app/notifications/actions";
import { getNsfwContentSetting } from "@/app/profile/nsfw-actions";
import { ChatNav } from "@/components/chat-nav";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { NotificationBell } from "@/components/notification-bell";
import { NsfwToggle } from "@/components/nsfw-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLinks } from "@/components/nav-links";
import { AccountSwitcherWrapper } from "@/components/account-switcher-wrapper";
import { loadLinkedAccounts } from "@/lib/account-linking-db";

export async function Header() {
  const session = await auth();
  const [conversations, unreadNotifications, recentNotifications, linkedAccounts, linkedAccountNotifCounts, showNsfwContent] = await Promise.all([
    session?.user ? getConversations() : Promise.resolve([]),
    session?.user ? getUnreadNotificationCount() : Promise.resolve(0),
    session?.user ? getRecentNotifications() : Promise.resolve([]),
    session?.user?.id ? loadLinkedAccounts(session.user.id) : Promise.resolve([]),
    session?.user ? getLinkedAccountNotificationCounts() : Promise.resolve({}),
    session?.user ? getNsfwContentSetting() : Promise.resolve(false),
  ]);

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-2 py-3 sm:px-4 md:flex-nowrap">
        {/* Logo + theme toggles */}
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
          {session?.user && <NsfwToggle initialEnabled={showNsfwContent} />}
        </div>

        {/* Nav links — row 2 on mobile, inline center on md+ */}
        {session?.user && (
          <div className="order-3 flex w-full items-center justify-end gap-1 border-t border-zinc-100 pt-2 md:order-2 md:w-auto md:justify-center md:border-0 md:pt-0 dark:border-zinc-800">
            <NavLinks username={session.user.username} />
          </div>
        )}

        {/* Action icons — chat, account switch, notifications */}
        {session?.user ? (
          <div className="order-2 ml-auto flex shrink-0 items-center gap-1 md:order-3 md:ml-0">
            <DynamicFavicon
              initialNotifCount={unreadNotifications}
              initialChatCount={conversations.reduce((sum: number, c: { unreadCount: number }) => sum + c.unreadCount, 0)}
            />
            <AccountSwitcherWrapper initialLinkedAccounts={linkedAccounts} initialNotificationCounts={linkedAccountNotifCounts} />
            <NotificationBell initialUnreadCount={unreadNotifications} initialNotifications={recentNotifications} />
            <ChatNav initialConversations={conversations} />
          </div>
        ) : (
          <Link
            href="/login"
            className="order-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:from-fuchsia-500 hover:to-blue-500"
          >
            Sign In
          </Link>
        )}
      </nav>
    </header>
  );
}
