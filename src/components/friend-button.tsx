"use client";

import { useState, useActionState } from "react";
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  type FriendshipStatus,
} from "@/app/feed/friend-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface FriendButtonProps {
  userId: string;
  friendshipStatus: FriendshipStatus;
  requestId?: string;
}

const initialState = { success: false, message: "" };

export function FriendButton({
  userId,
  friendshipStatus,
  requestId,
}: FriendButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const [sendState, sendAction, sendPending] = useActionState(
    sendFriendRequest,
    initialState
  );
  const [, acceptAction, acceptPending] = useActionState(
    acceptFriendRequest,
    initialState
  );
  const [, declineAction, declinePending] = useActionState(
    declineFriendRequest,
    initialState
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeFriend,
    initialState
  );

  const isPending = sendPending || acceptPending || declinePending || removePending;

  const handleUnfriendClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmUnfriend = () => {
    setShowConfirm(false);
    const form = document.getElementById(`friend-remove-form-${userId}`) as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  // After successful send, show Pending
  if (sendState.success || friendshipStatus === "pending_sent") {
    return (
      <span className="rounded-full border border-fuchsia-300 bg-fuchsia-50 px-4 py-1.5 text-sm font-semibold text-fuchsia-500 dark:border-fuchsia-700 dark:bg-fuchsia-950/30 dark:text-fuchsia-400">
        Pending
      </span>
    );
  }

  // After successful remove, show Add Friend
  if (removeState.success || friendshipStatus === "none") {
    return (
      <form action={sendAction}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-semibold whitespace-nowrap text-zinc-700 transition-all hover:border-fuchsia-400 hover:text-fuchsia-600 disabled:opacity-50 dark:border-zinc-600 dark:bg-transparent dark:text-zinc-300 dark:hover:border-fuchsia-500 dark:hover:text-fuchsia-400"
        >
          {sendPending ? "..." : "Add Friend"}
        </button>
      </form>
    );
  }

  if (friendshipStatus === "pending_received") {
    return (
      <div className="flex gap-2">
        <form action={acceptAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-fuchsia-600 px-4 py-1.5 text-sm font-semibold whitespace-nowrap text-white transition-all hover:bg-fuchsia-700 disabled:opacity-50 dark:bg-fuchsia-500 dark:hover:bg-fuchsia-600"
          >
            {acceptPending ? "..." : "Accept"}
          </button>
        </form>
        <form action={declineAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-semibold whitespace-nowrap text-zinc-700 transition-all hover:border-zinc-400 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-600 dark:bg-transparent dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
          >
            {declinePending ? "..." : "Decline"}
          </button>
        </form>
      </div>
    );
  }

  // friends — active state with confirmation on unfriend
  return (
    <>
      <form id={`friend-remove-form-${userId}`} action={removeAction}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="button"
          onClick={handleUnfriendClick}
          disabled={isPending}
          className="rounded-full bg-fuchsia-600 px-4 py-1.5 text-sm font-semibold whitespace-nowrap text-white transition-all hover:bg-fuchsia-700 disabled:opacity-50 dark:bg-fuchsia-500 dark:hover:bg-fuchsia-600"
        >
          {removePending ? "..." : "Friends"}
        </button>
      </form>

      <ConfirmDialog
        open={showConfirm}
        title="Unfriend?"
        message="Are you sure you want to remove this friend? You will need to send a new friend request to reconnect."
        confirmLabel="Unfriend"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmUnfriend}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
