import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getBlockedUsers } from "@/app/feed/block-actions";
import { BlockedUsersList } from "./blocked-users-list";

export const metadata: Metadata = {
  title: "Blocked Users",
  robots: { index: false, follow: false },
};

export default async function BlockedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const blockedUsers = await getBlockedUsers();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-red-600">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Blocked Users
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage users you have blocked
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <BlockedUsersList users={blockedUsers} />
      </div>
    </main>
  );
}
