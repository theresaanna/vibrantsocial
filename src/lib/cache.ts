import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * Generic cache-aside helper.
 * Returns cached value if present, otherwise calls `fn`, caches the result, and returns it.
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  if (!redis) return fn();

  const hit = await redis.get<T>(key);
  if (hit !== null && hit !== undefined) return hit;

  const value = await fn();
  await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  return value;
}

/** Read a cached value without populating on miss */
export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  return redis.get<T>(key);
}

/** Invalidate a specific cache key */
export async function invalidate(key: string) {
  if (!redis) return;
  await redis.del(key);
}

/** Invalidate all keys matching a pattern (use sparingly) */
export async function invalidatePattern(pattern: string) {
  if (!redis) return;
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(Number(cursor), {
      match: pattern,
      count: 100,
    });
    cursor = String(nextCursor);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}

/**
 * Invalidate multiple keys at once (more efficient than individual calls).
 */
export async function invalidateMany(keys: string[]) {
  if (!redis || keys.length === 0) return;
  await redis.del(...keys);
}

// Cache tags for unstable_cache / updateTag / revalidateTag
export const cacheTags = {
  statusFeed: "status-feed",
  marketplaceFeed: "marketplace-feed",
  activeChatrooms: "active-chatrooms",
} as const;

// Cache key builders
export const cacheKeys = {
  userFollowing: (userId: string) => `user:${userId}:following`,
  userProfile: (username: string) => `profile:${username}`,
  postCounts: (postId: string) => `post:${postId}:counts`,
  tagCloud: () => `tags:cloud`,
  nsfwTagCloud: () => `tags:nsfw-cloud`,
  allTagCloud: () => `tags:all-cloud`,
  tagPostCount: (tagName: string) => `tag:${tagName}:count`,
  userBlockedIds: (userId: string) => `user:${userId}:blocked`,
  userBlockedByIds: (userId: string) => `user:${userId}:blocked-by`,
  userAllBlocks: (userId: string) => `user:${userId}:all-blocks`,
  linkPreview: (url: string) => `linkpreview:${url}`,
  userLists: (userId: string) => `user:${userId}:lists`,
  userListMembers: (listId: string) => `list:${listId}:members`,
  userListSubscriptions: (userId: string) => `user:${userId}:list-subs`,
  userListCollaborators: (listId: string) => `list:${listId}:collaborators`,
  feedSummary: (userId: string) => `user:${userId}:feed-summary`,
  userPrefs: (userId: string) => `user:${userId}:prefs`,
  userCloseFriendOf: (userId: string) => `user:${userId}:close-friend-of`,
  userCloseFriendIds: (userId: string) => `user:${userId}:close-friend-ids`,
  friendshipStatus: (userA: string, userB: string) => {
    // Canonical ordering so both directions hit the same key
    const [a, b] = userA < userB ? [userA, userB] : [userB, userA];
    return `friendship:${a}:${b}`;
  },
  profileTabFlags: (userId: string) => `user:${userId}:tab-flags`,
  userBlockRelationships: (userId: string) => `user:${userId}:block-rels`,
  userMutedIds: (userId: string) => `user:${userId}:muted`,
  userSearch: (userId: string, query: string) => `search:users:${userId}:${query}`,
  postSearch: (userId: string, query: string) => `search:posts:${userId}:${query}`,
  tagSearch: (query: string, includeNsfw: boolean) => `search:tags:${query}:${includeNsfw ? 1 : 0}`,
  tagSearchForSearch: (userId: string, query: string) => `search:tagsearch:${userId}:${query}`,
  commentCount: (postId: string) => `post:${postId}:comment-count`,
  userNotifications: (userId: string) => `user:${userId}:notifications`,
  userRecentNotifications: (userId: string) => `user:${userId}:recent-notifications`,
  unreadNotificationCount: (userId: string) => `user:${userId}:unread-notif-count`,
  userConversations: (userId: string) => `user:${userId}:conversations`,
  linkedAccountNotifCounts: (userId: string) => `user:${userId}:linked-notif-counts`,
  linkedAccounts: (userId: string) => `user:${userId}:linked-accounts`,
  friendStatuses: (userId: string) => `user:${userId}:friend-statuses`,
  friendStatusList: (userId: string, limit: number) => `user:${userId}:friend-status-list:${limit}`,
  marketplacePage: (cursor: string | undefined, showNsfw: boolean, ageVerified: boolean, isLoggedIn: boolean) =>
    `marketplace:page:${cursor ?? "_"}:${showNsfw ? 1 : 0}:${ageVerified ? 1 : 0}:${isLoggedIn ? 1 : 0}`,
  activeChatRooms: (limit: number, showNsfw: boolean) =>
    `chatrooms:active:${limit}:${showNsfw ? 1 : 0}`,
} as const;
