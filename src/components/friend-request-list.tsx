"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import {
  acceptFriendRequest,
  declineFriendRequest,
} from "@/app/feed/friend-actions";
import { StyledName } from "@/components/styled-name";

interface FriendRequest {
  id: string;
  sender: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    avatar: string | null;
    profileFrameId: string | null;
    usernameFont?: string | null;
    ageVerified?: Date | null;
    image: string | null;
  };
}

interface FriendRequestListProps {
  requests: FriendRequest[];
}

function FriendRequestCard({ request }: { request: FriendRequest }) {
  const sender = request.sender;
  const displayName = sender.displayName ?? sender.username ?? sender.name ?? "User";
  const avatar = sender.avatar ?? sender.image;
  const initial = displayName[0]?.toUpperCase() || "?";

  const [acceptState, acceptAction, acceptPending] = useActionState(
    acceptFriendRequest,
    { success: false, message: "" }
  );
  const [declineState, declineAction, declinePending] = useActionState(
    declineFriendRequest,
    { success: false, message: "" }
  );

  if (acceptState.success) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <FramedAvatar src={avatar} initial={initial} size={56} frameId={sender.profileFrameId} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            You are now friends with {displayName}!
          </p>
        </div>
      </div>
    );
  }

  if (declineState.success) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link href={`/${sender.username}`} className="flex-shrink-0">
        <FramedAvatar src={avatar} initial={initial} size={56} frameId={sender.profileFrameId} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/${sender.username}`}
          className="block truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
        >
          <StyledName fontId={sender.usernameFont} ageVerified={!!sender.ageVerified}>{displayName}</StyledName>
        </Link>
        {sender.username && (
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            @{sender.username}
          </p>
        )}
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          wants to be your friend
        </p>
      </div>
      <div className="flex gap-2">
        <form action={acceptAction}>
          <input type="hidden" name="requestId" value={request.id} />
          <button
            type="submit"
            disabled={acceptPending || declinePending}
            className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-fuchsia-600 hover:to-pink-600 hover:shadow-md disabled:opacity-50"
          >
            {acceptPending ? "..." : "Accept"}
          </button>
        </form>
        <form action={declineAction}>
          <input type="hidden" name="requestId" value={request.id} />
          <button
            type="submit"
            disabled={acceptPending || declinePending}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {declinePending ? "..." : "Decline"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function FriendRequestList({ requests }: FriendRequestListProps) {
  if (requests.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No pending friend requests.
      </p>
    );
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {requests.map((request) => (
        <FriendRequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}
