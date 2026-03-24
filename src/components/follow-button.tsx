"use client";

import { useState, useActionState } from "react";
import { toggleFollow } from "@/app/feed/follow-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
}

export function FollowButton({ userId, isFollowing }: FollowButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [, formAction, isPending] = useActionState(toggleFollow, {
    success: false,
    message: "",
  });

  const handleClick = () => {
    if (isFollowing) {
      setShowConfirm(true);
    }
  };

  const handleConfirmUnfollow = () => {
    setShowConfirm(false);
    const form = document.getElementById(`follow-form-${userId}`) as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  return (
    <>
      <form id={`follow-form-${userId}`} action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        {isFollowing ? (
          <button
            type="button"
            onClick={handleClick}
            disabled={isPending}
            className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold whitespace-nowrap text-white transition-all hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isPending ? "..." : "Following"}
          </button>
        ) : (
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-semibold whitespace-nowrap text-zinc-700 transition-all hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-zinc-600 dark:bg-transparent dark:text-zinc-300 dark:hover:border-blue-500 dark:hover:text-blue-400"
          >
            {isPending ? "..." : "Follow"}
          </button>
        )}
      </form>

      <ConfirmDialog
        open={showConfirm}
        title="Unfollow?"
        message="Are you sure you want to unfollow this user? You will no longer see their posts in your feed."
        confirmLabel="Unfollow"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmUnfollow}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
