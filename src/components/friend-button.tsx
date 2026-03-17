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
      <span className="rounded-lg border-2 border-fuchsia-300 bg-fuchsia-50 px-3 py-1.5 text-sm font-semibold text-fuchsia-500 dark:border-fuchsia-700 dark:bg-fuchsia-950/30 dark:text-fuchsia-400">
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
          className="rounded-lg border-2 border-fuchsia-500 bg-transparent px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-fuchsia-600 transition-all hover:bg-fuchsia-50 hover:shadow-sm disabled:opacity-50 dark:text-fuchsia-400 dark:hover:bg-fuchsia-950/30"
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
            className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white shadow-sm transition-all hover:from-fuchsia-600 hover:to-pink-600 hover:shadow-md disabled:opacity-50"
          >
            {acceptPending ? "..." : "Accept"}
          </button>
        </form>
        <form action={declineAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {declinePending ? "..." : "Decline"}
          </button>
        </form>
      </div>
    );
  }

  // friends — vibrant active state with confirmation on unfriend
  return (
    <>
      <form id={`friend-remove-form-${userId}`} action={removeAction}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="button"
          onClick={handleUnfriendClick}
          disabled={isPending}
          className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white shadow-sm ring-2 ring-fuchsia-400/30 transition-all hover:from-fuchsia-600 hover:to-pink-600 hover:shadow-md disabled:opacity-50"
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
