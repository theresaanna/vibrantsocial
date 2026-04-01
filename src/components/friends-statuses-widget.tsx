"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import { StatusComposer } from "@/components/status-composer";
import { timeAgo } from "@/lib/time";
import type { FriendStatusData } from "@/app/feed/status-actions";

const ROTATE_INTERVAL_MS = 6_000;
const VISIBLE_COUNT = 2;

function StatusItem({
  status,
  isOwn,
  animate,
}: {
  status: FriendStatusData;
  isOwn: boolean;
  animate: boolean;
}) {
  return (
    <div
      key={status.id}
      className={`flex items-start gap-2.5 ${
        animate
          ? "animate-[statusSlideIn_0.4s_ease-out]"
          : ""
      }`}
    >
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
        <p
          className={`text-sm ${
            isOwn
              ? "font-bold text-zinc-900 dark:text-zinc-100"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {status.content}
        </p>
      </div>
    </div>
  );
}

export function FriendsStatusesWidget({
  statuses,
  currentUserId,
}: {
  statuses: FriendStatusData[];
  currentUserId?: string;
}) {
  const [ownStatuses, setOwnStatuses] = useState<FriendStatusData[]>([]);
  const [offset, setOffset] = useState(0);
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const prevVisibleIdsRef = useRef<Set<string>>(new Set());

  // Merge own statuses at the top, deduplicating
  const ownIds = new Set(ownStatuses.map((s) => s.id));
  const merged = [
    ...ownStatuses,
    ...statuses.filter((s) => !ownIds.has(s.id)),
  ];

  const rotate = useCallback(() => {
    if (merged.length <= VISIBLE_COUNT) return;
    setOffset((prev) => (prev + VISIBLE_COUNT) % merged.length);
  }, [merged.length]);

  useEffect(() => {
    if (merged.length <= VISIBLE_COUNT) return;
    const interval = setInterval(() => {
      if (!document.hidden) rotate();
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [rotate, merged.length]);

  // Reset offset when own status is added so it's immediately visible
  const handleStatusCreated = useCallback((status: FriendStatusData) => {
    setOwnStatuses((prev) => [status, ...prev]);
    setOffset(0);
    // Mark the new status as animating
    setAnimatingIds((prev) => new Set(prev).add(status.id));
    // Remove animation flag after it completes
    setTimeout(() => {
      setAnimatingIds((prev) => {
        const next = new Set(prev);
        next.delete(status.id);
        return next;
      });
    }, 500);
  }, []);

  // Circular slice
  const visible: FriendStatusData[] = [];
  for (let i = 0; i < Math.min(VISIBLE_COUNT, merged.length); i++) {
    visible.push(merged[(offset + i) % merged.length]);
  }

  // Detect newly visible statuses from rotation and animate them
  useEffect(() => {
    const currentIds = new Set(visible.map((s) => s.id));
    const newIds = new Set<string>();
    for (const id of currentIds) {
      if (!prevVisibleIdsRef.current.has(id)) {
        newIds.add(id);
      }
    }
    if (newIds.size > 0) {
      setAnimatingIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.add(id);
        return next;
      });
      setTimeout(() => {
        setAnimatingIds((prev) => {
          const next = new Set(prev);
          for (const id of newIds) next.delete(id);
          return next;
        });
      }, 500);
    }
    prevVisibleIdsRef.current = currentIds;
  }, [visible]);

  const isOwn = (status: FriendStatusData) =>
    currentUserId != null && status.user.id === currentUserId;

  return (
    <div
      className="mb-4 rounded-2xl bg-zinc-50 p-4 shadow-sm dark:bg-zinc-800"
      data-testid="friends-statuses-widget"
    >
      <style>{`
        @keyframes statusSlideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Friends&apos; Statuses
        </h3>
        {merged.length > 0 && (
          <Link
            href="/statuses"
            className="text-xs font-medium text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300"
            data-testid="view-all-statuses"
          >
            View all
          </Link>
        )}
      </div>
      <div className="mb-3">
        <StatusComposer onStatusCreated={handleStatusCreated} />
      </div>
      {merged.length === 0 ? (
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
          No friend statuses yet. Set yours above!
        </p>
      ) : (
      <div className="space-y-3">
        {visible.map((status) => (
          <StatusItem
            key={status.id}
            status={status}
            isOwn={isOwn(status)}
            animate={animatingIds.has(status.id)}
          />
        ))}
      </div>
      )}
    </div>
  );
}
