import { auth } from "@/auth";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { invalidate, cacheKeys } from "@/lib/cache";
import type { Session } from "next-auth";
import type { NotificationType } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ActionState {
  success: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Shared Prisma select constants
// ---------------------------------------------------------------------------

export const USER_PROFILE_SELECT = {
  id: true,
  username: true,
  displayName: true,
  name: true,
  avatar: true,
  image: true,
  profileFrameId: true,
  usernameFont: true,
} as const;

// ---------------------------------------------------------------------------
// Auth + rate limit helper
// ---------------------------------------------------------------------------

type AuthenticatedSession = Session & { user: Session["user"] & { id: string } };

/**
 * Validates the session and checks rate limiting in one call.
 * Returns the authenticated session or an ActionState error.
 */
export async function requireAuthWithRateLimit(
  rateLimitPrefix: string
): Promise<AuthenticatedSession | ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `${rateLimitPrefix}:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  return session as AuthenticatedSession;
}

/**
 * Type guard: returns true if the result is an ActionState error (not a session).
 */
export function isActionError(
  result: AuthenticatedSession | ActionState
): result is ActionState {
  return "success" in result && "message" in result && !("user" in result);
}

// ---------------------------------------------------------------------------
// Block check
// ---------------------------------------------------------------------------

/**
 * Returns true if a block exists between two users in either direction.
 */
export async function hasBlock(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    },
  });
  return !!block;
}

// ---------------------------------------------------------------------------
// Friendship check
// ---------------------------------------------------------------------------

/**
 * Returns true if two users have an accepted friendship.
 */
export async function areFriends(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const friendship = await prisma.friendRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: userId1, receiverId: userId2 },
        { senderId: userId2, receiverId: userId1 },
      ],
    },
  });
  return !!friendship;
}

// ---------------------------------------------------------------------------
// Group reactions
// ---------------------------------------------------------------------------

/**
 * Groups flat reaction rows into { emoji, userIds[] } arrays.
 */
export function groupReactions(
  reactions: { emoji: string; userId: string }[]
): { emoji: string; userIds: string[] }[] {
  const map = new Map<string, string[]>();
  for (const r of reactions) {
    const list = map.get(r.emoji) ?? [];
    list.push(r.userId);
    map.set(r.emoji, list);
  }
  return Array.from(map, ([emoji, userIds]) => ({ emoji, userIds }));
}

// ---------------------------------------------------------------------------
// Safe notification
// ---------------------------------------------------------------------------

/**
 * Wrapper around createNotification that silently catches errors.
 * Use for non-critical notifications where failure shouldn't break the action.
 */
export async function createNotificationSafe(params: {
  type: NotificationType;
  actorId: string;
  targetUserId: string;
  postId?: string;
  commentId?: string;
  messageId?: string;
  repostId?: string;
  tagId?: string;
}): Promise<void> {
  try {
    await createNotification(params);
  } catch {
    // Non-critical
  }
}

// ---------------------------------------------------------------------------
// Tag cache invalidation
// ---------------------------------------------------------------------------

/**
 * Invalidates tag cloud and per-tag post count caches.
 */
export async function invalidateTagCaches(
  tagNames: string[],
  isNsfw: boolean
): Promise<void> {
  if (isNsfw) {
    await invalidate(cacheKeys.nsfwTagCloud());
  } else {
    await invalidate(cacheKeys.tagCloud());
  }
  await Promise.all(
    tagNames.map((name) => invalidate(cacheKeys.tagPostCount(name)))
  );
}
