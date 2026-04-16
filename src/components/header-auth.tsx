import { auth } from "@/auth";
import Link from "next/link";
import { getConversations } from "@/app/messages/actions";
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
        className="shrink-0 rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:from-fuchsia-500 hover:to-blue-500"
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
    <div className="flex shrink-0 flex-wrap items-center gap-1 sm:flex-nowrap">
      {/* Nav links — renders two groups with a mobile line-break between them */}
      <NavLinks username={session.user.username} />

      {/* Action icons — order-1 keeps them on row 1 with the first nav group on mobile */}
      <div className="order-1 flex items-center gap-1 sm:order-none">
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
    </div>
  );
}
