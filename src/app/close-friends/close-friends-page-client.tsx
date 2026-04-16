"use client";

import { CloseFriendsClient } from "./close-friends-client";

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

interface Props {
  closeFriends: CloseFriendEntry[];
  availableFriends: FriendUser[];
}

export function CloseFriendsPageClient({
  closeFriends,
  availableFriends,
}: Props) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "var(--profile-link, #d946ef)" }}>
          <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 0 1 14 0H3.5ZM18 8.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM16.5 13c0-.78.145-1.527.41-2.215A5.98 5.98 0 0 0 13.5 9.75a5.973 5.973 0 0 0-1.958.33A7.02 7.02 0 0 1 17.5 16h4a.5.5 0 0 0 .5-.5 5.5 5.5 0 0 0-5.5-2.5Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Manage Close Friends
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Add or remove friends from your close friends list
          </p>
        </div>
      </div>

      <CloseFriendsClient
        closeFriends={closeFriends}
        availableFriends={availableFriends}
      />
    </div>
  );
}
