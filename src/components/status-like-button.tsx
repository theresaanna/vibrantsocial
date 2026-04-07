"use client";

import Link from "next/link";
import { useOptimisticToggle } from "@/hooks/use-optimistic-toggle";
import { toggleStatusLike } from "@/app/feed/status-actions";

interface StatusLikeButtonProps {
  statusId: string;
  username: string | null;
  likeCount: number;
  isLiked: boolean;
}

export function StatusLikeButton({
  statusId,
  username,
  likeCount,
  isLiked,
}: StatusLikeButtonProps) {
  const like = useOptimisticToggle(isLiked, likeCount, toggleStatusLike, {
    statusId,
  });

  return (
    <span className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={like.handleToggle}
        className={`rounded p-0.5 transition-colors ${
          like.value
            ? "text-red-500"
            : "text-zinc-400 hover:text-red-400 dark:text-zinc-500 dark:hover:text-red-400"
        }`}
        aria-label={like.value ? "Unlike status" : "Like status"}
      >
        <svg
          className="h-3.5 w-3.5"
          fill={like.value ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      </button>
      {like.count > 0 && (
        username ? (
          <Link
            href={`/statuses/${username}/${statusId}/likes`}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            data-testid="status-like-count"
          >
            {like.count}
          </Link>
        ) : (
          <span
            className="text-xs text-zinc-400 dark:text-zinc-500"
            data-testid="status-like-count"
          >
            {like.count}
          </span>
        )
      )}
    </span>
  );
}
