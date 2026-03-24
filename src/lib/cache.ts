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
  linkPreview: (url: string) => `linkpreview:${url}`,
  userLists: (userId: string) => `user:${userId}:lists`,
  userListMembers: (listId: string) => `list:${listId}:members`,
  userListSubscriptions: (userId: string) => `user:${userId}:list-subs`,
  userListCollaborators: (listId: string) => `list:${listId}:collaborators`,
} as const;
