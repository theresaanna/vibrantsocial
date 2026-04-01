"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import { StatusComposer } from "@/components/status-composer";
import { StatusLikeButton } from "@/components/status-like-button";
import { pollStatuses } from "@/app/feed/status-actions";
import { timeAgo } from "@/lib/time";
import type { FriendStatusData } from "@/app/feed/status-actions";

const ROTATE_INTERVAL_MS = 6_000;
const POLL_INTERVAL_MS = 30_000;

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
      className={`flex items-start gap-2.5 ${
        animate ? "animate-[statusSlideIn_0.4s_ease-out]" : ""
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
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm ${
              isOwn
                ? "font-bold text-zinc-900 dark:text-zinc-100"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {status.content}
          </p>
          <StatusLikeButton
            statusId={status.id}
            likeCount={status.likeCount}
            isLiked={status.isLiked}
          />
        </div>
      </div>
    </div>
  );
}

export function FriendsStatusesWidget({
  statuses: initialStatuses,
  currentUserId,
  initialOwnStatus = null,
}: {
  statuses: FriendStatusData[];
  currentUserId?: string;
  initialOwnStatus?: FriendStatusData | null;
}) {
  const [ownStatus, setOwnStatus] = useState<FriendStatusData | null>(initialOwnStatus);
  const [friendStatuses, setFriendStatuses] = useState<FriendStatusData[]>(initialStatuses);
  const [friendOffset, setFriendOffset] = useState(0);
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const prevVisibleIdsRef = useRef<Set<string>>(new Set());

  // How many friend slots are visible (1 if own status pinned, 2 otherwise)
  const friendSlots = ownStatus ? 1 : 2;

  // --- Rotation for friend statuses ---
  const rotate = useCallback(() => {
    if (friendStatuses.length <= friendSlots) return;
    setFriendOffset((prev) => (prev + friendSlots) % friendStatuses.length);
  }, [friendStatuses.length, friendSlots]);

  useEffect(() => {
    if (friendStatuses.length <= friendSlots) return;
    const interval = setInterval(() => {
      if (!document.hidden) rotate();
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [rotate, friendStatuses.length, friendSlots]);

  // --- Polling for fresh statuses ---
  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.hidden) return;
      try {
        const data = await pollStatuses(10);
        setFriendStatuses(data.friendStatuses);
        if (data.ownStatus) {
          setOwnStatus((prev) =>
            prev?.id === data.ownStatus!.id ? prev : data.ownStatus
          );
        }
      } catch {
        // Non-critical — will retry next interval
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // --- Handle new status from composer ---
  const handleStatusCreated = useCallback((status: FriendStatusData) => {
    setOwnStatus(status);
    setFriendOffset(0);
    // Animate the new status
    setAnimatingIds((prev) => new Set(prev).add(status.id));
    setTimeout(() => {
      setAnimatingIds((prev) => {
        const next = new Set(prev);
        next.delete(status.id);
        return next;
      });
    }, 500);
  }, []);

  // Build visible list: own status pinned at top + rotating friend statuses
  const visibleFriends: FriendStatusData[] = [];
  for (let i = 0; i < Math.min(friendSlots, friendStatuses.length); i++) {
    visibleFriends.push(
      friendStatuses[(friendOffset + i) % friendStatuses.length]
    );
  }

  const visible = [
    ...(ownStatus ? [ownStatus] : []),
    ...visibleFriends,
  ];

  // Detect newly visible statuses and animate them
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

  const hasAny = visible.length > 0;

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
        {hasAny && (
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
      {!hasAny ? (
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
          No friend statuses yet. Set yours above!
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((status) => (
            <StatusItem
              key={status.id}
              status={status}
              isOwn={currentUserId != null && status.user.id === currentUserId}
              animate={animatingIds.has(status.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
