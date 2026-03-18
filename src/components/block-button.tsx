"use client";

import { useState, useActionState } from "react";
import { toggleBlock } from "@/app/feed/block-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface BlockButtonProps {
  userId: string;
  isBlocked: boolean;
}

export function BlockButton({ userId, isBlocked }: BlockButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [, formAction, isPending] = useActionState(toggleBlock, {
    success: false,
    message: "",
  });

  const handleClick = () => {
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    const form = document.getElementById(`block-form-${userId}`) as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  return (
    <>
      <form id={`block-form-${userId}`} action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          title={isBlocked ? "Unblock user" : "Block user"}
          data-testid="profile-block-button"
          className={`rounded p-1 transition-colors disabled:opacity-50 ${
            isBlocked
              ? "text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </button>
      </form>

      <ConfirmDialog
        open={showConfirm}
        title={isBlocked ? "Unblock?" : "Block?"}
        message={
          isBlocked
            ? "Are you sure you want to unblock this user? They will be able to see your public content again."
            : "Are you sure you want to block this user? They won't be able to see your content and you won't see theirs. Existing follows and friend connections will be removed."
        }
        confirmLabel={isBlocked ? "Unblock" : "Block"}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
