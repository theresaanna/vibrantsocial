import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toggleBlock,
  getBlockStatus,
  getBlockedUserIds,
  getBlockedByUserIds,
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
    phoneBlock: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
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

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: {},
  isRateLimited: vi.fn().mockResolvedValue(false),
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

  it("transaction contains 5 operations for a standard block (no phone)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2" }));

    const txArgs = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
    expect(txArgs).toHaveLength(5);
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

describe("toggleBlock phone blocking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates PhoneBlock and blocks other accounts sharing same phone", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique
      .mockResolvedValueOnce(null as never) // initial check
      .mockResolvedValueOnce(null as never); // check for alt-account
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    // Target user lookup for phone
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ phoneNumber: "+1555000", phoneVerified: new Date() } as never)
      // Cache invalidation lookups
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);
    // Other accounts with same phone
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "alt-account1" },
    ] as never);

    const result = await toggleBlock(
      prevState,
      makeFormData({ userId: "user2", blockByPhone: "true" })
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe("Blocked");

    const txArgs = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
    // 5 ops for target + 1 PhoneBlock upsert + 5 ops for alt-account = 11
    expect(txArgs).toHaveLength(11);
  });

  it("skips already-blocked accounts when phone blocking", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique
      .mockResolvedValueOnce(null as never) // initial check
      .mockResolvedValueOnce({ id: "existing" } as never); // alt already blocked
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ phoneNumber: "+1555000", phoneVerified: new Date() } as never)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "alt-account1" },
    ] as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2", blockByPhone: "true" }));

    const txArgs = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
    // 5 ops for target + 1 PhoneBlock upsert = 6 (alt skipped because already blocked)
    expect(txArgs).toHaveLength(6);
  });

  it("does not create PhoneBlock when target has no verified phone", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ phoneNumber: null, phoneVerified: null } as never)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2", blockByPhone: "true" }));

    const txArgs = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
    // Standard 5 ops only — no PhoneBlock created
    expect(txArgs).toHaveLength(5);
  });

  it("excludes self and target from other-accounts phone search", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ phoneNumber: "+1555000", phoneVerified: new Date() } as never)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2", blockByPhone: "true" }));

    const findManyCall = (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(findManyCall.where.id.notIn).toContain("user1");
    expect(findManyCall.where.id.notIn).toContain("user2");
  });

  it("does not phone-block when blockByPhone is false", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.block.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.$transaction.mockResolvedValueOnce([] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "currentuser" } as never)
      .mockResolvedValueOnce({ username: "targetuser" } as never);

    await toggleBlock(prevState, makeFormData({ userId: "user2", blockByPhone: "false" }));

    const txArgs = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
    expect(txArgs).toHaveLength(5);
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
    (mockPrisma.phoneBlock.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);

    const result = await getBlockedUserIds("user1");
    expect(result).toEqual([]);
  });

  it("returns correct IDs of directly blocked users", async () => {
    mockPrisma.block.findMany.mockResolvedValueOnce([
      { blockedId: "user2" },
      { blockedId: "user3" },
    ] as never);
    (mockPrisma.phoneBlock.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);

    const result = await getBlockedUserIds("user1");
    expect(result).toEqual(["user2", "user3"]);
  });

  it("includes phone-blocked users in results", async () => {
    mockPrisma.block.findMany.mockResolvedValueOnce([
      { blockedId: "user2" },
    ] as never);
    mockPrisma.phoneBlock.findMany.mockResolvedValueOnce([
      { phoneNumber: "+1555000" },
    ] as never);
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: "user3" },
      { id: "user4" },
    ] as never);

    const result = await getBlockedUserIds("user1");
    expect(result).toContain("user2");
    expect(result).toContain("user3");
    expect(result).toContain("user4");
  });

  it("deduplicates direct and phone-blocked users", async () => {
    mockPrisma.block.findMany.mockResolvedValueOnce([
      { blockedId: "user2" },
    ] as never);
    mockPrisma.phoneBlock.findMany.mockResolvedValueOnce([
      { phoneNumber: "+1555000" },
    ] as never);
    // user2 appears again via phone
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: "user2" },
      { id: "user3" },
    ] as never);

    const result = await getBlockedUserIds("user1");
    expect(result).toHaveLength(2);
    expect(result).toContain("user2");
    expect(result).toContain("user3");
  });
});

describe("getBlockedByUserIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns direct blockers when user has no verified phone", async () => {
    mockPrisma.block.findMany.mockResolvedValueOnce([
      { blockerId: "user2" },
    ] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      phoneNumber: null,
      phoneVerified: null,
    } as never);

    const result = await getBlockedByUserIds("user1");
    expect(result).toEqual(["user2"]);
  });

  it("includes phone blockers when user has verified phone", async () => {
    mockPrisma.block.findMany.mockResolvedValueOnce([
      { blockerId: "user2" },
    ] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      phoneNumber: "+1555000",
      phoneVerified: new Date(),
    } as never);
    (mockPrisma.phoneBlock.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { blockerId: "user3" },
    ] as never);

    const result = await getBlockedByUserIds("user1");
    expect(result).toContain("user2");
    expect(result).toContain("user3");
  });
});

describe("getAllBlockRelatedIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns union of both directions without duplicates", async () => {
    // getBlockedUserIds calls
    mockPrisma.block.findMany
      .mockResolvedValueOnce([{ blockedId: "user2" }, { blockedId: "user3" }] as never)
    ;(mockPrisma.phoneBlock.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);
    // getBlockedByUserIds calls
    mockPrisma.block.findMany
      .mockResolvedValueOnce([{ blockerId: "user3" }, { blockerId: "user4" }] as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      phoneNumber: null,
      phoneVerified: null,
    } as never);

    const result = await getAllBlockRelatedIds("user1");
    // user3 appears in both directions, should be deduplicated
    expect(result).toHaveLength(3);
    expect(result).toContain("user2");
    expect(result).toContain("user3");
    expect(result).toContain("user4");
  });
});
