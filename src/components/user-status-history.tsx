"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import { timeAgo } from "@/lib/time";
import { deleteStatus } from "@/app/feed/status-actions";
import { StatusLikeButton } from "@/components/status-like-button";
import type { FriendStatusData } from "@/app/feed/status-actions";

function DeleteStatusButton({ statusId }: { statusId: string }) {
  const [, formAction, isPending] = useActionState(deleteStatus, {
    success: false,
    message: "",
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="statusId" value={statusId} />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50 dark:text-red-400"
        data-testid="delete-status-btn"
      >
        {isPending ? "..." : "Delete"}
      </button>
    </form>
  );
}

export function UserStatusHistory({
  statuses,
  currentUserId,
  username,
}: {
  statuses: FriendStatusData[];
  currentUserId?: string;
  username: string;
}) {
  const isOwner = currentUserId === statuses[0]?.user.id;

  if (statuses.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No statuses yet.
      </p>
    );
  }

  const user = statuses[0].user;

  return (
    <div className="space-y-3">
      {/* User header */}
      <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
        <Link href={`/${username}`}>
          <FramedAvatar
            src={user.avatar || user.image}
            alt={user.displayName || user.username || "User"}
            size={40}
            frameId={user.profileFrameId}
          />
        </Link>
        <Link
          href={`/${username}`}
          className="text-base font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
        >
          <StyledName fontId={user.usernameFont}>
            {user.displayName || user.name || user.username}
          </StyledName>
        </Link>
      </div>

      {/* Status list */}
      {statuses.map((status) => (
        <div
          key={status.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-zinc-100 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800"
          data-testid="status-history-item"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              {status.content}
            </p>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {timeAgo(status.createdAt)}
              </span>
              <StatusLikeButton
                statusId={status.id}
                likeCount={status.likeCount}
                isLiked={status.isLiked}
              />
            </div>
          </div>
          {isOwner && <DeleteStatusButton statusId={status.id} />}
        </div>
      ))}
    </div>
  );
}
