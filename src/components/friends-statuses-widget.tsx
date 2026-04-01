"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import { timeAgo } from "@/lib/time";
import type { FriendStatusData } from "@/app/feed/status-actions";

const ROTATE_INTERVAL_MS = 6_000;
const VISIBLE_COUNT = 2;

export function FriendsStatusesWidget({
  statuses,
}: {
  statuses: FriendStatusData[];
}) {
  const [offset, setOffset] = useState(0);

  const rotate = useCallback(() => {
    if (statuses.length <= VISIBLE_COUNT) return;
    setOffset((prev) => (prev + VISIBLE_COUNT) % statuses.length);
  }, [statuses.length]);

  useEffect(() => {
    if (statuses.length <= VISIBLE_COUNT) return;
    const interval = setInterval(() => {
      if (!document.hidden) rotate();
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [rotate, statuses.length]);

  if (statuses.length === 0) return null;

  // Circular slice
  const visible: FriendStatusData[] = [];
  for (let i = 0; i < Math.min(VISIBLE_COUNT, statuses.length); i++) {
    visible.push(statuses[(offset + i) % statuses.length]);
  }

  return (
    <div
      className="mb-4 rounded-2xl bg-zinc-50 p-4 shadow-sm dark:bg-zinc-800"
      data-testid="friends-statuses-widget"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Friends&apos; Statuses
        </h3>
        <Link
          href="/statuses"
          className="text-xs font-medium text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300"
          data-testid="view-all-statuses"
        >
          View all
        </Link>
      </div>
      <div className="space-y-3">
        {visible.map((status) => (
          <div key={status.id} className="flex items-start gap-2.5">
            <Link href={`/${status.user.username}`} className="shrink-0">
              <FramedAvatar
                src={status.user.avatar || status.user.image}
                alt={status.user.displayName || status.user.username || "User"}
                size={32}
                frameId={status.user.profileFrameId}
              />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <Link
                  href={`/${status.user.username}`}
                  className="truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  <StyledName fontId={status.user.usernameFont}>
                    {status.user.displayName || status.user.name || status.user.username}
                  </StyledName>
                </Link>
                <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                  {timeAgo(status.createdAt)}
                </span>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {status.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
