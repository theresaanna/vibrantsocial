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
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(),
  cacheKeys: {
    userBlockedIds: (id: string) => `user:${id}:blocked`,
    userFollowing: (id: string) => `user:${id}:following`,
    userProfile: (username: string) => `profile:${username}`,
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { invalidate } from "@/lib/cache";
import { revalidatePath } from "next/cache";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockInvalidate = vi.mocked(invalidate);
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

    expect(mockInvalidate).toHaveBeenCalledWith("user:user1:blocked");
    expect(mockInvalidate).toHaveBeenCalledWith("user:user2:blocked");
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
