import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getNotifications } from "./actions";
import { NotificationList } from "@/components/notification-list";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [notifications, themeUser] = await Promise.all([
    getNotifications(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: userThemeSelect,
    }),
  ]);

  const theme = themeUser ? buildUserTheme(themeUser) : null;

  return (
    <ThemedPage {...(theme ?? NO_THEME)}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "var(--profile-link, #d946ef)" }}>
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Notifications
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Stay up to date
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <NotificationList initialNotifications={notifications} />
      </div>
    </ThemedPage>
  );
}
