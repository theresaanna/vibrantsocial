import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

function createLimiter(
  window: ReturnType<typeof Ratelimit.slidingWindow>,
  prefix: string
): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({ redis, limiter: window, analytics: true, prefix });
}

// Sliding window rate limiters for different route types
export const uploadLimiter = createLimiter(
  Ratelimit.slidingWindow(10, "1 m"),
  "ratelimit:upload"
);

export const apiLimiter = createLimiter(
  Ratelimit.slidingWindow(30, "1 m"),
  "ratelimit:api"
);

export const authLimiter = createLimiter(
  Ratelimit.slidingWindow(5, "1 m"),
  "ratelimit:auth"
);

export const friendLimiter = createLimiter(
  Ratelimit.slidingWindow(50, "1 h"),
  "ratelimit:friend"
);

export const searchLimiter = createLimiter(
  Ratelimit.slidingWindow(30, "1 m"),
  "ratelimit:search"
);

export const chatMessageLimiter = createLimiter(
  Ratelimit.slidingWindow(60, "1 m"),
  "ratelimit:chat-msg"
);

export const chatConversationLimiter = createLimiter(
  Ratelimit.slidingWindow(10, "1 m"),
  "ratelimit:chat-conv"
);

export const chatRequestLimiter = createLimiter(
  Ratelimit.slidingWindow(5, "1 h"),
  "ratelimit:chat-req"
);

// Sparkle-click star reward: 5 successful claims per 24h per user.
// Fail-open if Redis is unavailable — this is cosmetic, not financial.
export const sparkleRewardLimiter = createLimiter(
  Ratelimit.slidingWindow(5, "1 d"),
  "ratelimit:sparkle-reward"
);

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<NextResponse | null> {
  if (!limiter) return null;

  const { success, limit, reset, remaining } = await limiter.limit(identifier);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      }
    );
  }

  return null;
}

/**
 * Rate limit check for server actions (returns boolean instead of NextResponse).
 * Returns true if the request is rate limited.
 */
export async function isRateLimited(
  limiter: Ratelimit | null,
  identifier: string
): Promise<boolean> {
  if (!limiter) return false;
  const { success } = await limiter.limit(identifier);
  return !success;
}
