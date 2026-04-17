import { auth } from "@/auth";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { invalidate, cacheKeys } from "@/lib/cache";
import { getMobileSession } from "@/lib/mobile-session-context";
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
  ageVerified: true,
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
  // Try cookie-based auth first, then fall back to mobile bearer token
  const session = (await auth()) ?? getMobileSession() ?? null;
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
 * Groups flat reaction rows into { emoji, userIds[], userNames[] } arrays.
 */
export function groupReactions(
  reactions: { emoji: string; userId: string; user?: { displayName: string | null; username: string | null } }[]
): { emoji: string; userIds: string[]; userNames: string[] }[] {
  const map = new Map<string, { userIds: string[]; userNames: string[] }>();
  for (const r of reactions) {
    const group = map.get(r.emoji) ?? { userIds: [], userNames: [] };
    group.userIds.push(r.userId);
    group.userNames.push(r.user?.displayName ?? r.user?.username ?? "Someone");
    map.set(r.emoji, group);
  }
  return Array.from(map, ([emoji, { userIds, userNames }]) => ({ emoji, userIds, userNames }));
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
  userListId?: string;
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
