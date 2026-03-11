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
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
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
