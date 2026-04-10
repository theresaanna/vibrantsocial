import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMutedUsers } from "@/app/feed/block-actions";
import { MutedUsersList } from "./muted-users-list";

export const metadata: Metadata = {
  title: "Muted Users",
  robots: { index: false, follow: false },
};

export default async function MutedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const mutedUsers = await getMutedUsers();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Muted Users
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Muted users&apos; posts are hidden from your feeds. They can still see your content and you remain connected.
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <MutedUsersList users={mutedUsers} />
      </div>
    </main>
  );
}
