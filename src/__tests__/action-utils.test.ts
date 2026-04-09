import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requireAuthWithRateLimit,
  isActionError,
  hasBlock,
  areFriends,
  groupReactions,
  createNotificationSafe,
  invalidateTagCaches,
} from "@/lib/action-utils";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: {},
  isRateLimited: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    block: {
      findFirst: vi.fn(),
    },
    friendRequest: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: {
    tagCloud: () => "tags:cloud",
    nsfwTagCloud: () => "tags:nsfw-cloud",
    tagPostCount: (name: string) => `tag:${name}:count`,
  },
}));

import { auth } from "@/auth";
import { isRateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { invalidate } from "@/lib/cache";

const mockAuth = vi.mocked(auth);
const mockIsRateLimited = vi.mocked(isRateLimited);
const mockBlockFindFirst = vi.mocked(prisma.block.findFirst);
const mockFriendRequestFindFirst = vi.mocked(prisma.friendRequest.findFirst);
const mockCreateNotification = vi.mocked(createNotification);
const mockInvalidate = vi.mocked(invalidate);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// requireAuthWithRateLimit
// ---------------------------------------------------------------------------

describe("requireAuthWithRateLimit", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await requireAuthWithRateLimit("test");

    expect(result).toEqual({
      success: false,
      message: "Not authenticated",
    });
  });

  it("returns error when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} } as never);

    const result = await requireAuthWithRateLimit("test");

    expect(result).toEqual({
      success: false,
      message: "Not authenticated",
    });
  });

  it("returns error when rate limited", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockIsRateLimited.mockResolvedValue(true);

    const result = await requireAuthWithRateLimit("test");

    expect(result).toEqual({
      success: false,
      message: "Too many requests. Please try again later.",
    });
    expect(mockIsRateLimited).toHaveBeenCalledWith(
      expect.anything(),
      "test:user-1"
    );
  });

  it("returns session when authenticated and not rate limited", async () => {
    const session = { user: { id: "user-1", name: "Test" } };
    mockAuth.mockResolvedValue(session as never);
    mockIsRateLimited.mockResolvedValue(false);

    const result = await requireAuthWithRateLimit("test");

    expect(result).toEqual(session);
  });

  it("uses the correct rate limit prefix", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-42" } } as never);
    mockIsRateLimited.mockResolvedValue(false);

    await requireAuthWithRateLimit("chat-msg");

    expect(mockIsRateLimited).toHaveBeenCalledWith(
      expect.anything(),
      "chat-msg:user-42"
    );
  });
});

// ---------------------------------------------------------------------------
// isActionError
// ---------------------------------------------------------------------------

describe("isActionError", () => {
  it("returns true for ActionState objects", () => {
    expect(isActionError({ success: false, message: "error" })).toBe(true);
    expect(isActionError({ success: true, message: "ok" })).toBe(true);
  });

  it("returns false for session objects with user", () => {
    const session = { user: { id: "user-1" }, success: true, message: "ok" };
    // A real session has a `user` property, so isActionError returns false
    expect(isActionError(session as never)).toBe(false);
  });

  it("returns false for session objects", () => {
    const session = { user: { id: "user-1", name: "Test" } };
    expect(isActionError(session as never)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasBlock
// ---------------------------------------------------------------------------

describe("hasBlock", () => {
  it("returns true when a block exists", async () => {
    mockBlockFindFirst.mockResolvedValue({ id: "block-1" } as never);

    expect(await hasBlock("a", "b")).toBe(true);
  });

  it("returns false when no block exists", async () => {
    mockBlockFindFirst.mockResolvedValue(null);

    expect(await hasBlock("a", "b")).toBe(false);
  });

  it("queries both directions", async () => {
    mockBlockFindFirst.mockResolvedValue(null);

    await hasBlock("user-1", "user-2");

    expect(mockBlockFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { blockerId: "user-1", blockedId: "user-2" },
          { blockerId: "user-2", blockedId: "user-1" },
        ],
      },
    });
  });
});

// ---------------------------------------------------------------------------
// areFriends
// ---------------------------------------------------------------------------

describe("areFriends", () => {
  it("returns true when accepted friendship exists", async () => {
    mockFriendRequestFindFirst.mockResolvedValue({ id: "fr-1" } as never);

    expect(await areFriends("a", "b")).toBe(true);
  });

  it("returns false when no friendship exists", async () => {
    mockFriendRequestFindFirst.mockResolvedValue(null);

    expect(await areFriends("a", "b")).toBe(false);
  });

  it("queries for ACCEPTED status in both directions", async () => {
    mockFriendRequestFindFirst.mockResolvedValue(null);

    await areFriends("user-1", "user-2");

    expect(mockFriendRequestFindFirst).toHaveBeenCalledWith({
      where: {
        status: "ACCEPTED",
        OR: [
          { senderId: "user-1", receiverId: "user-2" },
          { senderId: "user-2", receiverId: "user-1" },
        ],
      },
    });
  });
});

// ---------------------------------------------------------------------------
// groupReactions
// ---------------------------------------------------------------------------

describe("groupReactions", () => {
  it("groups reactions by emoji", () => {
    const reactions = [
      { emoji: "👍", userId: "u1" },
      { emoji: "👍", userId: "u2" },
      { emoji: "❤️", userId: "u1" },
    ];

    const result = groupReactions(reactions);

    expect(result).toEqual([
      { emoji: "👍", userIds: ["u1", "u2"] },
      { emoji: "❤️", userIds: ["u1"] },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(groupReactions([])).toEqual([]);
  });

  it("handles single reaction", () => {
    const result = groupReactions([{ emoji: "🎉", userId: "u1" }]);
    expect(result).toEqual([{ emoji: "🎉", userIds: ["u1"] }]);
  });

  it("preserves insertion order of emojis", () => {
    const reactions = [
      { emoji: "❤️", userId: "u1" },
      { emoji: "👍", userId: "u2" },
      { emoji: "❤️", userId: "u3" },
    ];

    const result = groupReactions(reactions);

    expect(result[0].emoji).toBe("❤️");
    expect(result[1].emoji).toBe("👍");
  });
});

// ---------------------------------------------------------------------------
// createNotificationSafe
// ---------------------------------------------------------------------------

describe("createNotificationSafe", () => {
  it("calls createNotification with params", async () => {
    mockCreateNotification.mockResolvedValue(undefined as never);

    await createNotificationSafe({
      type: "LIKE" as never,
      actorId: "actor-1",
      targetUserId: "target-1",
      postId: "post-1",
    });

    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "LIKE",
      actorId: "actor-1",
      targetUserId: "target-1",
      postId: "post-1",
    });
  });

  it("does not throw when createNotification fails", async () => {
    mockCreateNotification.mockRejectedValue(new Error("DB error"));

    await expect(
      createNotificationSafe({
        type: "FOLLOW" as never,
        actorId: "a",
        targetUserId: "b",
      })
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// invalidateTagCaches
// ---------------------------------------------------------------------------

describe("invalidateTagCaches", () => {
  it("invalidates SFW tag cloud for non-NSFW tags", async () => {
    await invalidateTagCaches(["tag1", "tag2"], false);

    expect(mockInvalidate).toHaveBeenCalledWith("tags:cloud");
    expect(mockInvalidate).not.toHaveBeenCalledWith("tags:nsfw-cloud");
    expect(mockInvalidate).toHaveBeenCalledWith("tag:tag1:count");
    expect(mockInvalidate).toHaveBeenCalledWith("tag:tag2:count");
  });

  it("invalidates NSFW tag cloud for NSFW tags", async () => {
    await invalidateTagCaches(["nsfw-tag"], true);

    expect(mockInvalidate).toHaveBeenCalledWith("tags:nsfw-cloud");
    expect(mockInvalidate).not.toHaveBeenCalledWith("tags:cloud");
    expect(mockInvalidate).toHaveBeenCalledWith("tag:nsfw-tag:count");
  });

  it("handles empty tag array", async () => {
    await invalidateTagCaches([], false);

    expect(mockInvalidate).toHaveBeenCalledWith("tags:cloud");
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });
});
