"use client";

import { useActionState } from "react";
import { addCloseFriend, removeCloseFriend } from "@/app/feed/close-friends-actions";
import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";

interface FriendUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  profileFrameId: string | null;
  usernameFont: string | null;
}

interface CloseFriendEntry {
  id: string;
  friendId: string;
  friend: FriendUser;
}

interface CloseFriendsClientProps {
  closeFriends: CloseFriendEntry[];
  availableFriends: FriendUser[];
}

function UserAvatar({ user }: { user: FriendUser }) {
  const src = user.avatar || user.image;
  const initial = (user.displayName || user.username || "?")[0]?.toUpperCase();

  return (
    <FramedAvatar src={src} initial={initial} size={50} frameId={user.profileFrameId} referrerPolicy="no-referrer" />
  );
}

function RemoveButton({ friendId }: { friendId: string }) {
  const [, formAction, isPending] = useActionState(removeCloseFriend, {
    success: false,
    message: "",
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="friendId" value={friendId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-400"
      >
        {isPending ? "Removing..." : "Remove"}
      </button>
    </form>
  );
}

function AddButton({ friendId }: { friendId: string }) {
  const [, formAction, isPending] = useActionState(addCloseFriend, {
    success: false,
    message: "",
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="friendId" value={friendId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:from-fuchsia-500 hover:to-blue-500 disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add"}
      </button>
    </form>
  );
}

export function CloseFriendsClient({
  closeFriends,
  availableFriends,
}: CloseFriendsClientProps) {
  return (
    <div>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Only you can see this list. Posts marked &quot;close friends only&quot; will only be visible to people on this list.
      </p>

      {/* Current close friends */}
      {closeFriends.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Your close friends ({closeFriends.length})
          </h2>
          <div className="space-y-2">
            {closeFriends.map((cf) => (
              <div
                key={cf.id}
                className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-900"
              >
                <UserAvatar user={cf.friend} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${cf.friend.username}`}
                    className="block truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    <StyledName fontId={cf.friend.usernameFont}>{cf.friend.displayName || cf.friend.name || cf.friend.username}</StyledName>
                  </Link>
                  <span className="text-sm text-zinc-500">
                    @{cf.friend.username}
                  </span>
                </div>
                <RemoveButton friendId={cf.friendId} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available friends to add */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Add from your friends
        </h2>
        {availableFriends.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {closeFriends.length > 0
                ? "All your friends are already on your close friends list."
                : "You don't have any friends yet. Add friends first to build your close friends list."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {availableFriends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-900"
              >
                <UserAvatar user={friend} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${friend.username}`}
                    className="block truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    <StyledName fontId={friend.usernameFont}>{friend.displayName || friend.name || friend.username}</StyledName>
                  </Link>
                  <span className="text-sm text-zinc-500">
                    @{friend.username}
                  </span>
                </div>
                <AddButton friendId={friend.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
