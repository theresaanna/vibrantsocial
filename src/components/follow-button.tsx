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
            className="rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white shadow-sm ring-2 ring-blue-400/30 transition-all hover:from-blue-600 hover:to-cyan-600 hover:shadow-md disabled:opacity-50"
          >
            {isPending ? "..." : "Following"}
          </button>
        ) : (
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg border-2 border-blue-500 bg-transparent px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-blue-600 transition-all hover:bg-blue-50 hover:shadow-sm disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
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
