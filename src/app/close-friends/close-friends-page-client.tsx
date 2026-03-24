"use client";

import { useState } from "react";
import { PostCard } from "@/components/post-card";
import { RepostCard } from "@/components/repost-card";
import { CloseFriendsClient } from "./close-friends-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeedItem = { type: "post" | "repost"; data: any; date: string };

interface FriendUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  profileFrameId: string | null;
}

interface CloseFriendEntry {
  id: string;
  friendId: string;
  friend: FriendUser;
}

interface Props {
  initialItems: FeedItem[];
  initialHasMore: boolean;
  currentUserId: string;
  phoneVerified: boolean;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  showNsfwContent: boolean;
  closeFriends: CloseFriendEntry[];
  availableFriends: FriendUser[];
}

export function CloseFriendsPageClient({
  initialItems,
  initialHasMore,
  currentUserId,
  phoneVerified,
  ageVerified,
  showGraphicByDefault,
  showNsfwContent,
  closeFriends,
  availableFriends,
}: Props) {
  const [tab, setTab] = useState<"feed" | "manage">("feed");

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600">
          <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 0 1 14 0H3.5ZM18 8.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM16.5 13c0-.78.145-1.527.41-2.215A5.98 5.98 0 0 0 13.5 9.75a5.973 5.973 0 0 0-1.958.33A7.02 7.02 0 0 1 17.5 16h4a.5.5 0 0 0 .5-.5 5.5 5.5 0 0 0-5.5-2.5Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Close Friends
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Posts from your close friends
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        <button
          onClick={() => setTab("feed")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === "feed" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"}`}
        >
          Feed
        </button>
        <button
          onClick={() => setTab("manage")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === "manage" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"}`}
        >
          Manage List
        </button>
      </div>

      {tab === "feed" && (
        <CloseFriendsFeed
          items={initialItems}
          currentUserId={currentUserId}
          phoneVerified={phoneVerified}
          ageVerified={ageVerified}
          showGraphicByDefault={showGraphicByDefault}
          showNsfwContent={showNsfwContent}
          closeFriendsCount={closeFriends.length}
        />
      )}

      {tab === "manage" && (
        <CloseFriendsClient
          closeFriends={closeFriends}
          availableFriends={availableFriends}
        />
      )}
    </div>
  );
}

function CloseFriendsFeed({
  items,
  currentUserId,
  phoneVerified,
  ageVerified,
  showGraphicByDefault,
  showNsfwContent,
  closeFriendsCount,
}: {
  items: FeedItem[];
  currentUserId: string;
  phoneVerified: boolean;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  showNsfwContent: boolean;
  closeFriendsCount: number;
}) {
  if (closeFriendsCount === 0) {
    return (
      <div className="mt-8 text-center">
        <p className="text-zinc-500">No close friends yet.</p>
        <p className="mt-1 text-sm text-zinc-400">
          Switch to &quot;Manage List&quot; to add friends to your close friends list.
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 text-center">
        <p className="text-zinc-500">No posts from your close friends yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) =>
        item.type === "post" ? (
          <PostCard
            key={item.data.id}
            post={item.data}
            currentUserId={currentUserId}
            phoneVerified={phoneVerified}
            ageVerified={ageVerified}
            showGraphicByDefault={showGraphicByDefault}
            showNsfwContent={showNsfwContent}
            {...(item.data.wallPost && {
              wallOwner: {
                username: item.data.wallPost.wallOwner.username,
                displayName: item.data.wallPost.wallOwner.displayName,
              },
              wallPostId: item.data.wallPost.id,
              wallPostStatus: item.data.wallPost.status,
            })}
          />
        ) : (
          <RepostCard
            key={`repost-${item.data.id}`}
            repost={item.data}
            currentUserId={currentUserId}
            phoneVerified={phoneVerified}
            ageVerified={ageVerified}
            showGraphicByDefault={showGraphicByDefault}
            showNsfwContent={showNsfwContent}
          />
        )
      )}
    </div>
  );
}
