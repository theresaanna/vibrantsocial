"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useChannel, ChannelProvider } from "ably/react";
import { useAblyReady } from "@/app/providers";
import { AddToHomeBanner } from "@/components/add-to-home-banner";
import { AddEmailBanner } from "@/components/add-email-banner";
import { FeedList } from "@/components/feed-list";
import { rpc } from "@/lib/rpc";
import { FeedSummaryBanner } from "@/components/feed-summary-banner";
import type { FeedSummaryResult } from "@/app/feed/summary-actions";
import { FriendsStatusesWidget } from "@/components/friends-statuses-widget";
import { FeedViewToggleWrapper } from "@/components/feed-view-toggle-wrapper";
import Link from "next/link";
import { MediaFeedClientContent } from "@/components/media-feed-client-content";
import type { FeedView } from "@/components/feed-view-toggle";
import type { FriendStatusData } from "@/app/feed/status-actions";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeedItem = { type: "post" | "repost"; data: any; date: string };

const POLL_INTERVAL_MS = 60_000; // 60 seconds

interface FeedClientProps {
  phoneVerified: boolean;
  isOldEnough: boolean;
  initialItems: FeedItem[];
  initialHasMore: boolean;
  currentUserId: string;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  showNsfwContent: boolean;
  hideSensitiveOverlay: boolean;
  hideNsfwOverlay: boolean;
  hasEmail: boolean;
  isPremium: boolean;
  listId?: string;
  lastSeenFeedAt?: string | null;
  initialSummaryData?: FeedSummaryResult | null;
  activeView?: FeedView;
  fetchPage?: (cursor: string) => Promise<{ items: FeedItem[]; hasMore: boolean }>;
  friendStatuses?: FriendStatusData[];
  initialOwnStatus?: FriendStatusData | null;
}

function FeedMarketplaceSubscription({
  currentUserId,
  onNewPost,
}: {
  currentUserId: string;
  onNewPost: (postId: string) => void;
}) {
  useChannel(`feed:${currentUserId}`, "new-post", (event) => {
    const postId = event.data?.postId as string | undefined;
    if (postId) onNewPost(postId);
  });
  return null;
}

export function FeedClient({
  phoneVerified,
  isOldEnough,
  initialItems,
  initialHasMore,
  currentUserId,
  ageVerified,
  showGraphicByDefault,
  showNsfwContent,
  hideSensitiveOverlay,
  hideNsfwOverlay,
  hasEmail,
  isPremium,
  listId,
  lastSeenFeedAt,
  initialSummaryData,
  activeView = "posts",
  fetchPage,
  friendStatuses = [],
  initialOwnStatus = null,
}: FeedClientProps) {
  const isAblyReady = useAblyReady();
  const [newItems, setNewItems] = useState<FeedItem[]>([]);
  const newestDateRef = useRef<string>(
    initialItems[0]?.date ?? new Date().toISOString()
  );

  // Keep newestDateRef in sync when new items arrive
  useEffect(() => {
    if (newItems.length > 0 && newItems[0].date > newestDateRef.current) {
      newestDateRef.current = newItems[0].date;
    }
  }, [newItems]);

  const handlePostCreated = useCallback(async (postId: string) => {
    const item = await rpc<FeedItem | null>("fetchSinglePost", postId);
    if (item) {
      setNewItems((prev) => [item, ...prev]);
    }
  }, []);

  // Poll for new posts from followed users (skip for "for-you" since it's randomized)
  useEffect(() => {
    if (listId === "for-you") return;

    const interval = setInterval(async () => {
      // Only poll when tab is visible
      if (document.hidden) return;

      try {
        const items: FeedItem[] = listId
          ? await rpc("fetchNewListFeedItems", listId, newestDateRef.current)
          : await rpc("fetchNewFeedItems", newestDateRef.current);
        if (items.length > 0) {
          setNewItems((prev) => {
            const existingIds = new Set(
              prev.map((item) =>
                item.type === "post" ? item.data.id : `repost-${item.data.id}`
              )
            );
            const toAdd = items.filter((item: FeedItem) => {
              const key =
                item.type === "post"
                  ? item.data.id
                  : `repost-${item.data.id}`;
              return !existingIds.has(key);
            });
            if (toAdd.length === 0) return prev;
            return [...toAdd, ...prev];
          });
        }
      } catch {
        // Non-critical — will retry next interval
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [listId]);

  return (
    <>
      {isAblyReady && (
        <ChannelProvider channelName={`feed:${currentUserId}`}>
          <FeedMarketplaceSubscription
            currentUserId={currentUserId}
            onNewPost={handlePostCreated}
          />
        </ChannelProvider>
      )}
      <AddToHomeBanner />
      <AddEmailBanner hasEmail={hasEmail} />
      {!listId && lastSeenFeedAt && (
        <div className="mb-4 flex flex-col gap-4 md:flex-row">
          <div className="min-w-0 flex-1">
            <FeedSummaryBanner lastSeenFeedAt={lastSeenFeedAt} initialData={initialSummaryData ?? undefined} />
          </div>
          <div className="w-full shrink-0 rounded-2xl bg-zinc-50 p-4 shadow-sm md:w-64 dark:bg-zinc-800">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
              Most Active Chatrooms
            </h3>
            <ul className="mt-2 space-y-1">
              <li>
                <Link
                  href="/communities/chatrooms"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <span className="text-fuchsia-500">#</span>
                  General Chat
                </Link>
              </li>
            </ul>
          </div>
        </div>
      )}
      {!listId && (
        <FriendsStatusesWidget
          statuses={friendStatuses}
          currentUserId={currentUserId}
          initialOwnStatus={initialOwnStatus}
        />
      )}
      {!listId && (
        <FeedViewToggleWrapper activeView={activeView} />
      )}
      {activeView === "media" ? (
        <MediaFeedClientContent />
      ) : (
        <FeedList
          initialItems={initialItems}
          initialHasMore={initialHasMore}
          currentUserId={currentUserId}
          phoneVerified={phoneVerified}
          ageVerified={ageVerified}
          showGraphicByDefault={showGraphicByDefault}
          showNsfwContent={showNsfwContent}
          hideSensitiveOverlay={hideSensitiveOverlay}
          hideNsfwOverlay={hideNsfwOverlay}
          newItems={newItems}
          fetchPage={fetchPage}
        />
      )}
    </>
  );
}
