"use client";

import { useActionState } from "react";
import { addCloseFriend, removeCloseFriend } from "@/app/feed/close-friends-actions";

interface CloseFriendButtonProps {
  userId: string;
  isCloseFriend: boolean;
  hasCustomTheme: boolean;
}

export function CloseFriendButton({ userId, isCloseFriend: initial, hasCustomTheme }: CloseFriendButtonProps) {
  const [addState, addAction, addPending] = useActionState(addCloseFriend, { success: false, message: "" });
  const [removeState, removeAction, removePending] = useActionState(removeCloseFriend, { success: false, message: "" });

  const pending = addPending || removePending;
  const isClose = addState.success ? true : removeState.success ? false : initial;

  const base = "rounded-full border px-3 py-1 text-xs font-semibold transition-all disabled:opacity-50";
  const themed = hasCustomTheme
    ? "profile-share-btn"
    : isClose
      ? "border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:border-pink-700 dark:bg-pink-900/30 dark:text-pink-300 dark:hover:bg-pink-900/50"
      : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-600 dark:bg-transparent dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-200";

  return (
    <form action={isClose ? removeAction : addAction}>
      <input type="hidden" name="friendId" value={userId} />
      <button
        type="submit"
        disabled={pending}
        className={`${base} ${themed}`}
        style={
          hasCustomTheme
            ? ({ borderColor: "var(--profile-secondary)", color: "var(--profile-text)" } as React.CSSProperties)
            : undefined
        }
      >
        {pending ? "..." : isClose ? "★ Close Friend" : "☆ Add Close Friend"}
      </button>
    </form>
  );
}
