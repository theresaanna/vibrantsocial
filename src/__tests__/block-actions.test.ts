import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toggleBlock,
  getBlockStatus,
  getBlockedUserIds,
  getAllBlockRelatedIds,
} from "@/app/feed/block-actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    block: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    follow: {
      deleteMany: vi.fn(),
    },
    friendRequest: {
      deleteMany: vi.fn(),
    },
    postSubscription: {
      deleteMany: vi.fn(),
    },
    closeFriend: {
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    phoneBlock: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(),
  invalidateMany: vi.fn(),
  cacheKeys: {
    userBlockedIds: (id: string) => `user:${id}:blocked`,
    userBlockedByIds: (id: string) => `user:${id}:blocked-by`,
    userAllBlocks: (id: string) => `user:${id}:all-blocks`,
    userFollowing: (id: string) => `user:${id}:following`,
    userCloseFriendIds: (id: string) => `user:${id}:close-friends`,
    userCloseFriendOf: (id: string) => `user:${id}:close-friend-of`,
    friendshipStatus: (id1: string, id2: string) => `friendship:${id1}:${id2}`,
    userProfile: (username: string) => `profile:${username}`,
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { invalidate, invalidateMany } from "@/lib/cache";
import { revalidatePath } from "next/cache";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockInvalidate = vi.mocked(invalidate);
const mockInvalidateMany = vi.mocked(invalidateMany);
const mockRevalidatePath = vi.mocked(revalidatePath);

const prevState = { success: false, message: "" };

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

describe("toggleBlock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await toggleBlock(prevState, makeFormData({ userId: "u2" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error when trying to block yourself", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await toggleBlock(prevState, makeFormData({ userId: "user1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Cannot block yourself");
  });

  it("creates Block record when none exists", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    const result = await toggleBlock(prevState, makeFormData({ userId: "user2" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Blocked");
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("deletes mutual follows in both directions when blocking", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2" }));

    const txArgs = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
    // The transaction should contain 5 operations (block create, follow delete, friend delete, subscription delete, close friend delete)
    expect(txArgs).toHaveLength(5);
  });

  it("deletes friend requests in both directions when blocking", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2" }));

    // Verify transaction was called with all expected operations
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("deletes post subscriptions in both directions when blocking", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2" }));

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("deletes close friend entries in both directions when blocking", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2" }));

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("invalidates all relevant cache keys for both users", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2" }));

    // Block caches invalidated via invalidateMany (called by invalidateBlockCaches)
    expect(mockInvalidateMany).toHaveBeenCalled();
    // Other caches invalidated individually
    expect(mockInvalidate).toHaveBeenCalledWith("user:user1:following");
    expect(mockInvalidate).toHaveBeenCalledWith("user:user2:following");
    expect(mockInvalidate).toHaveBeenCalledWith("profile:currentuser");
    expect(mockInvalidate).toHaveBeenCalledWith("profile:targetuser");
  });

  it("removes existing block when toggling off (unblock)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce({
      id: "block1",
      blockerId: "user1",
      blockedId: "user2",
    } as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    const result = await toggleBlock(prevState, makeFormData({ userId: "user2" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Unblocked");
    expect(mockPrisma.block.delete).toHaveBeenCalledWith({ where: { id: "block1" } });
  });

  it("does not auto-restore follows/friends on unblock", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce({
      id: "block1",
      blockerId: "user1",
      blockedId: "user2",
    } as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2" }));

    // $transaction should NOT be called on unblock (no follow/friend restoration)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("calls revalidatePath('/')", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2" }));

    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("toggleBlock with blockByPhone", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks all accounts sharing the same verified phone number", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);

    // Target user has verified phone
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ phoneNumber: "+15551234567", phoneVerified: new Date() } as never)
      // Cache invalidation lookups
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    // Other accounts with the same phone
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "user3" },
      { id: "user4" },
    ] as never);
    mockPrisma.phoneBlock.upsert.mockResolvedValueOnce({} as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);

    const result = await toggleBlock(
      prevState,
      makeFormData({ userId: "user2", blockByPhone: "true" })
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe("Blocked");

    // Should create PhoneBlock record
    expect(mockPrisma.phoneBlock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          blockerId_phoneNumber: {
            blockerId: "user1",
            phoneNumber: "+15551234567",
          },
        },
        create: { blockerId: "user1", phoneNumber: "+15551234567" },
      })
    );

    // Transaction should include operations for all 3 users (user2, user3, user4)
    const txArgs = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
    // 5 operations per user (upsert block, delete follows, delete friends, delete subs, delete close friends) × 3 users
    expect(txArgs).toHaveLength(15);
  });

  it("does not phone-block when target has no verified phone", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);

    // Target has phone but not verified
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ phoneNumber: "+15551234567", phoneVerified: null } as never)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    mockPrisma.$transaction.mockResolvedValueOnce([] as never);

    const result = await toggleBlock(
      prevState,
      makeFormData({ userId: "user2", blockByPhone: "true" })
    );

    expect(result.success).toBe(true);
    // Should NOT look up other accounts or create PhoneBlock
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.phoneBlock.upsert).not.toHaveBeenCalled();

    // Transaction should only contain operations for the single target
    const txArgs = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
    expect(txArgs).toHaveLength(5);
  });

  it("does not phone-block when blockByPhone is not set", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2" }));

    expect(mockPrisma.phoneBlock.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("excludes the blocker's own account from phone-based blocks", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);

    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ phoneNumber: "+15551234567", phoneVerified: new Date() } as never)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);
    mockPrisma.phoneBlock.upsert.mockResolvedValueOnce({} as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2", blockByPhone: "true" }));

    // findMany should exclude both the blocker and the target
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: ["user1", "user2"] },
          phoneNumber: "+15551234567",
          phoneVerified: { not: null },
        }),
      })
    );
  });
});

describe("getBlockStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 'none' when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await getBlockStatus("user2");
    expect(result).toBe("none");
  });

  it("returns 'none' when no block exists", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findFirst.mockResolvedValueOnce(null as never);

    const result = await getBlockStatus("user2");
    expect(result).toBe("none");
  });

  it("returns 'blocked_by_me' when current user blocked target", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findFirst.mockResolvedValueOnce({
      blockerId: "user1",
    } as never);

    const result = await getBlockStatus("user2");
    expect(result).toBe("blocked_by_me");
  });

  it("returns 'blocked_by_them' when target blocked current user", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findFirst.mockResolvedValueOnce({
      blockerId: "user2",
    } as never);

    const result = await getBlockStatus("user2");
    expect(result).toBe("blocked_by_them");
  });
});

describe("getBlockedUserIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when no blocks", async () => {
    mockPrisma.block.findMany.mockResolvedValueOnce([] as never);

    const result = await getBlockedUserIds("user1");
    expect(result).toEqual([]);
  });

  it("returns correct IDs of blocked users", async () => {
    mockPrisma.block.findMany.mockResolvedValueOnce([
      { blockedId: "user2" },
      { blockedId: "user3" },
    ] as never);

    const result = await getBlockedUserIds("user1");
    expect(result).toEqual(["user2", "user3"]);
  });
});

describe("getAllBlockRelatedIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns union of both directions without duplicates", async () => {
    // First call is getBlockedUserIds (via cached -> findMany with blockerId)
    // Second call is getBlockedByUserIds (findMany with blockedId)
    mockPrisma.block.findMany
      .mockResolvedValueOnce([
        { blockedId: "user2" },
        { blockedId: "user3" },
      ] as never)
      .mockResolvedValueOnce([
        { blockerId: "user3" },
        { blockerId: "user4" },
      ] as never);

    const result = await getAllBlockRelatedIds("user1");
    // user3 appears in both directions, should be deduplicated
    expect(result).toHaveLength(3);
    expect(result).toContain("user2");
    expect(result).toContain("user3");
    expect(result).toContain("user4");
  });
});
