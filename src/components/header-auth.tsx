import { auth } from "@/auth";
import Link from "next/link";
import { getConversations } from "@/app/chat/actions";
import {
  getUnreadNotificationCount,
  getRecentNotifications,
  getLinkedAccountNotificationCounts,
} from "@/app/notifications/actions";
import { ChatNav } from "@/components/chat-nav";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { NotificationBell } from "@/components/notification-bell";
import { NavLinks } from "@/components/nav-links";
import { AccountSwitcherWrapper } from "@/components/account-switcher-wrapper";
import { loadLinkedAccounts } from "@/lib/account-linking-db";

/**
 * Async server component for the auth-dependent header content.
 * Wrapped in <Suspense> by the parent Header so the page shell
 * (logo, theme toggle) streams immediately while these DB queries resolve.
 */
export async function HeaderAuth() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="order-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:from-fuchsia-500 hover:to-blue-500"
      >
        Sign In
      </Link>
    );
  }

  const [
    conversations,
    unreadNotifications,
    recentNotifications,
    linkedAccounts,
    linkedAccountNotifCounts,
  ] = await Promise.all([
    getConversations(),
    getUnreadNotificationCount(),
    getRecentNotifications(),
    session.user.id
      ? loadLinkedAccounts(session.user.id)
      : Promise.resolve([]),
    getLinkedAccountNotificationCounts(),
  ]);

  return (
    <>
      {/* Nav links — row 2 on mobile, inline center on md+ */}
      <div className="order-3 flex w-full items-center justify-end gap-1 border-t border-zinc-100 pl-2 pt-2 md:order-2 md:w-auto md:justify-center md:border-0 md:pl-0 md:pt-0 dark:border-zinc-800">
        <NavLinks username={session.user.username} />
      </div>

      {/* Action icons — chat, account switch, notifications */}
      <div className="order-2 ml-auto flex shrink-0 items-center gap-1 md:order-3 md:ml-0">
        <DynamicFavicon
          initialNotifCount={unreadNotifications}
          initialChatCount={conversations.reduce(
            (sum: number, c: { unreadCount: number }) => sum + c.unreadCount,
            0
          )}
        />
        <AccountSwitcherWrapper
          initialLinkedAccounts={linkedAccounts}
          initialNotificationCounts={linkedAccountNotifCounts}
        />
        <NotificationBell
          initialUnreadCount={unreadNotifications}
          initialNotifications={recentNotifications}
        />
        <ChatNav initialConversations={conversations} />
      </div>
    </>
  );
}
