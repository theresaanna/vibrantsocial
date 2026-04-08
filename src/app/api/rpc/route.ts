/**
 * Generic RPC route for read-only server functions.
 *
 * Client components should call server functions through this endpoint
 * (via the `callRpc` helper) instead of invoking server actions directly
 * whenever the call happens *automatically* (timers, effects, scroll
 * observers, debounced inputs, etc.).
 *
 * Why: server action responses include RSC "flight data" for the current
 * page. When an in-flight action resolves after the user has navigated
 * away, the stale flight data causes the router to briefly flash the
 * previous page. Plain JSON from a route handler has no flight data.
 */
import { NextResponse } from "next/server";

import { searchUsers, searchPosts, searchTagsForSearch, searchMarketplacePosts } from "@/app/search/actions";
import { fetchNewFeedItems, fetchSinglePost, fetchFeedPage } from "@/app/feed/feed-actions";
import { fetchNewListFeedItems } from "@/app/lists/actions";
import { getConversations } from "@/app/chat/actions";
import { getMessages } from "@/app/chat/actions";
import { getUnreadNotificationCount, getRecentNotifications } from "@/app/notifications/actions";
import { fetchNewcomers } from "@/app/communities/newcomer-actions";
import { fetchTopDiscussedPosts } from "@/app/communities/discussion-actions";
import { fetchCommunitiesMediaPage } from "@/app/communities/media-actions";
import { fetchSpotlightUsers } from "@/app/communities/spotlight-actions";
import { pollStatuses } from "@/app/feed/status-actions";
import { fetchMediaFeedPage } from "@/app/feed/media-actions";
import { recordPostView } from "@/app/feed/view-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */
const ACTIONS: Record<string, (...args: any[]) => Promise<any>> = {
  searchUsers,
  searchPosts,
  searchTagsForSearch,
  searchMarketplacePosts,
  fetchNewFeedItems,
  fetchSinglePost,
  fetchFeedPage,
  fetchNewListFeedItems,
  getConversations,
  getMessages,
  getUnreadNotificationCount,
  getRecentNotifications,
  fetchNewcomers,
  fetchTopDiscussedPosts,
  fetchCommunitiesMediaPage,
  fetchSpotlightUsers,
  pollStatuses,
  fetchMediaFeedPage,
  recordPostView,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
  let body: { action?: string; args?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, args = [] } = body;
  if (!action || !ACTIONS[action]) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const result = await ACTIONS[action](...args);
    return NextResponse.json(result ?? null);
  } catch (e) {
    console.error(`[rpc] ${action} failed:`, e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
