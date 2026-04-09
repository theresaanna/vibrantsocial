"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toggleMute } from "@/app/feed/block-actions";

interface MutedUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
}

function UnmuteButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(() => {
          toggleMute(formData);
        });
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-amber-200 px-3 py-1.5 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
      >
        {isPending ? "Unmuting..." : "Unmute"}
      </button>
    </form>
  );
}

export function MutedUsersList({ users }: { users: MutedUser[] }) {
  if (users.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">
          You haven&apos;t muted anyone.
        </p>
      </div>
    );
  }

  return (
    <ul>
      {users.map((user) => {
        const displayName = user.displayName || user.username;
        const initial = (displayName || "?")[0].toUpperCase();

        return (
          <li
            key={user.id}
            className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-800"
          >
            <Link href={`/${user.username}`} className="shrink-0">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {initial}
                </div>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/${user.username}`}
                className="block truncate font-medium text-zinc-900 hover:underline dark:text-zinc-100"
              >
                {displayName}
              </Link>
              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                @{user.username}
              </p>
            </div>
            <UnmuteButton userId={user.id} />
          </li>
        );
      })}
    </ul>
  );
}
