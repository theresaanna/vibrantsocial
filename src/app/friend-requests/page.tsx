import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPendingFriendRequests } from "@/app/feed/friend-actions";
import { FriendRequestList } from "@/components/friend-request-list";

export const metadata: Metadata = {
  title: "Friend Requests",
  robots: { index: false, follow: false },
};

export default async function FriendRequestsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const requests = await getPendingFriendRequests();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "var(--profile-link, #d946ef)" }}>
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Friend Requests
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            People who want to connect with you
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <FriendRequestList requests={requests} />
      </div>
    </main>
  );
}
