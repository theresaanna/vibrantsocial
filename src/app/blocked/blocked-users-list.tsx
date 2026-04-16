"use client";

import { useActionState } from "react";
import Link from "next/link";
import { toggleBlock } from "@/app/feed/block-actions";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";

interface BlockedUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  profileFrameId: string | null;
  usernameFont: string | null;
  ageVerified?: Date | null;
}

function UnblockButton({ userId }: { userId: string }) {
  const [state, formAction, isPending] = useActionState(toggleBlock, {
    success: false,
    message: "",
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="blockByPhone" value="false" />
      <button
        type="submit"
        disabled={isPending}
        data-testid={`unblock-button-${userId}`}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        {isPending ? "Unblocking..." : state.success ? "Unblocked" : "Unblock"}
      </button>
    </form>
  );
}

export function BlockedUsersList({ users }: { users: BlockedUser[] }) {
  if (users.length === 0) {
    return (
      <div className="px-6 py-12 text-center" data-testid="no-blocked-users">
        <p className="text-zinc-500 dark:text-zinc-400">
          You haven&apos;t blocked anyone.
        </p>
      </div>
    );
  }

  return (
    <ul data-testid="blocked-users-list">
      {users.map((user) => {
        const displayName = user.displayName || user.name || user.username;
        const avatarSrc = user.avatar || user.image;
        const initial = (displayName || "?")[0].toUpperCase();

        return (
          <li
            key={user.id}
            className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-800"
            data-testid={`blocked-user-${user.id}`}
          >
            <Link href={`/${user.username}`} className="shrink-0">
              <FramedAvatar
                src={avatarSrc}
                alt=""
                initial={initial}
                size={40}
                frameId={user.profileFrameId}
              />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/${user.username}`}
                className="block truncate font-medium text-zinc-900 hover:underline dark:text-zinc-100"
              >
                <StyledName fontId={user.usernameFont} ageVerified={!!user.ageVerified}>{displayName}</StyledName>
              </Link>
              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                @{user.username}
              </p>
            </div>
            <UnblockButton userId={user.id} />
          </li>
        );
      })}
    </ul>
  );
}
