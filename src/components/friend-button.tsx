"use client";

import { useActionState } from "react";
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  type FriendshipStatus,
} from "@/app/feed/friend-actions";

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

  // After successful send, show Pending
  if (sendState.success || friendshipStatus === "pending_sent") {
    return (
      <span className="rounded-lg border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
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
          className="rounded-lg bg-fuchsia-500 px-4 py-1.5 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-fuchsia-600 disabled:opacity-50"
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
            className="rounded-lg bg-fuchsia-500 px-4 py-1.5 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-fuchsia-600 disabled:opacity-50"
          >
            {acceptPending ? "..." : "Accept"}
          </button>
        </form>
        <form action={declineAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg border border-zinc-200 px-4 py-1.5 text-sm font-medium whitespace-nowrap text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {declinePending ? "..." : "Decline"}
          </button>
        </form>
      </div>
    );
  }

  // friends
  return (
    <form action={removeAction}>
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-zinc-200 px-4 py-1.5 text-sm font-medium whitespace-nowrap text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {removePending ? "..." : "Friends"}
      </button>
    </form>
  );
}
