import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getNotifications } from "./actions";
import { NotificationList } from "@/components/notification-list";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const notifications = await getNotifications();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
        Notifications
      </h1>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <NotificationList initialNotifications={notifications} />
      </div>
    </main>
  );
}
