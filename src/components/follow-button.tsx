"use client";

import { useActionState } from "react";
import { toggleFollow } from "@/app/feed/follow-actions";

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
}

export function FollowButton({ userId, isFollowing }: FollowButtonProps) {
  const [, formAction, isPending] = useActionState(toggleFollow, {
    success: false,
    message: "",
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={isPending}
        className={`rounded-lg px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 ${
          isFollowing
            ? "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        }`}
      >
        {isPending ? "..." : isFollowing ? "Remove Friend" : "Add Friend"}
      </button>
    </form>
  );
}
