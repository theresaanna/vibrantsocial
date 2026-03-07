"use client";

import Link from "next/link";
import { FollowButton } from "@/components/follow-button";
import type { FollowUser } from "@/app/feed/follow-actions";

interface UserListProps {
  users: FollowUser[];
  currentUserId: string | null;
  emptyMessage: string;
}

export function UserList({ users, currentUserId, emptyMessage }: UserListProps) {
  if (users.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {users.map((user) => {
        const displayName = user.displayName || user.name || user.username || "User";
        const avatarSrc = user.avatar || user.image;
        const initial = displayName[0]?.toUpperCase() || "?";

        return (
          <div
            key={user.id}
            className="flex items-center gap-3 px-4 py-3"
          >
            <Link href={`/${user.username}`} className="flex-shrink-0">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {initial}
                </div>
              )}
            </Link>

            <div className="min-w-0 flex-1">
              <Link
                href={`/${user.username}`}
                className="block truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
              >
                {displayName}
              </Link>
              {user.username && (
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  @{user.username}
                </p>
              )}
            </div>

            {currentUserId && user.id !== currentUserId && (
              <FollowButton userId={user.id} isFollowing={user.isFollowing} />
            )}
          </div>
        );
      })}
    </div>
  );
}
