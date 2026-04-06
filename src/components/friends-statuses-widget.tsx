"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import { StatusComposer } from "@/components/status-composer";
import { StatusLikeButton } from "@/components/status-like-button";
import { StatusReplyButton } from "@/components/status-reply-button";
import { rpc } from "@/lib/rpc";
import type { FriendStatusData } from "@/app/feed/status-actions";
import { timeAgo } from "@/lib/time";
import type { FriendStatusData } from "@/app/feed/status-actions";

const POLL_INTERVAL_MS = 30_000;

function StatusCard({
  status,
  isOwn,
}: {
  status: FriendStatusData;
  isOwn: boolean;
}) {
  return (
    <div className="flex w-64 shrink-0 flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <Link href={`/${status.user.username}`} className="shrink-0">
          <FramedAvatar
            src={status.user.avatar || status.user.image}
            alt={status.user.displayName || status.user.username || "User"}
            size={28}
            frameId={status.user.profileFrameId}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/${status.user.username}`}
            className="block truncate text-xs font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            <StyledName fontId={status.user.usernameFont}>
              {status.user.displayName || status.user.name || status.user.username}
            </StyledName>
          </Link>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {timeAgo(status.createdAt)}
          </span>
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p
          className={`text-sm leading-snug ${
            isOwn
              ? "font-bold text-zinc-900 dark:text-zinc-100"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {status.content}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {!isOwn && (
            <StatusReplyButton
              userId={status.user.id}
              statusContent={status.content}
              authorName={status.user.displayName || status.user.name || status.user.username || "User"}
            />
          )}
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  // Merge: own status first, then friends (deduplicated)
  const allStatuses = [
    ...(ownStatus ? [ownStatus] : []),
    ...friendStatuses.filter((s) => s.id !== ownStatus?.id),
  ];

  // --- Check scroll state ---
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, allStatuses.length]);

  // --- Scroll handlers ---
  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 272; // w-64 (256px) + gap (16px)
    el.scrollBy({
      left: direction === "right" ? cardWidth : -cardWidth,
      behavior: "smooth",
    });
  }, []);

  // --- Polling for fresh statuses ---
  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.hidden) return;
      try {
        const data = await rpc<{ ownStatus: FriendStatusData | null; friendStatuses: FriendStatusData[] }>("pollStatuses", 10);
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
    // Scroll to start to show the new status
    scrollRef.current?.scrollTo?.({ left: 0, behavior: "smooth" });
  }, []);

  const hasAny = allStatuses.length > 0;

  return (
    <div
      className="mb-4 rounded-2xl bg-zinc-50 p-4 shadow-sm dark:bg-zinc-800"
      data-testid="friends-statuses-widget"
    >
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
        <div className="relative">
          {/* Scrollable container */}
          {/* Hide scrollbar across browsers */}
          <style>{`
            .status-scroll::-webkit-scrollbar { display: none; }
            .status-scroll { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>
          <div
            ref={scrollRef}
            className="status-scroll flex gap-3 overflow-x-auto scroll-smooth"
            data-testid="status-scroll-container"
          >
            {allStatuses.map((status) => (
              <StatusCard
                key={status.id}
                status={status}
                isOwn={currentUserId != null && status.user.id === currentUserId}
              />
            ))}
          </div>

          {/* Left arrow */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scroll("left")}
              className="absolute -left-2 top-1/2 -translate-y-1/2 rounded-full border border-zinc-200 bg-white p-1.5 shadow-md transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600"
              aria-label="Scroll statuses left"
              data-testid="status-scroll-left"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 text-zinc-600 dark:text-zinc-300"
              >
                <path
                  fillRule="evenodd"
                  d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}

          {/* Right arrow */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scroll("right")}
              className="absolute -right-2 top-1/2 -translate-y-1/2 rounded-full border border-zinc-200 bg-white p-1.5 shadow-md transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600"
              aria-label="Scroll statuses right"
              data-testid="status-scroll-right"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 text-zinc-600 dark:text-zinc-300"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
