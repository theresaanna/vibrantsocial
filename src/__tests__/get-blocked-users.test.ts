import { describe, it, expect, vi, beforeEach } from "vitest";
import { getBlockedUsers } from "@/app/feed/block-actions";

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
    follow: { deleteMany: vi.fn() },
    friendRequest: { deleteMany: vi.fn() },
    postSubscription: { deleteMany: vi.fn() },
    closeFriend: { deleteMany: vi.fn() },
    phoneBlock: { findMany: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
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

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: {},
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

describe("getBlockedUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const result = await getBlockedUsers();

    expect(result).toEqual([]);
  });

  it("returns empty array when user has no blocks", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "me" } } as never);
    // getBlockedUserIds internals
    (mockPrisma.block.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (mockPrisma.phoneBlock.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const result = await getBlockedUsers();

    expect(result).toEqual([]);
  });

  it("returns user objects for blocked users", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "me" } } as never);
    // getBlockedUserIds: direct blocks
    (mockPrisma.block.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { blockedId: "blocked1" },
      { blockedId: "blocked2" },
    ]);
    // getBlockedUserIds: phone blocks
    (mockPrisma.phoneBlock.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    // findMany for user objects
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "blocked1",
        username: "alice",
        displayName: "Alice",
        name: "Alice A",
        avatar: "/alice.jpg",
        image: null,
        profileFrameId: null,
        usernameFont: null,
        phoneVerified: null,
      },
      {
        id: "blocked2",
        username: "bob",
        displayName: "Bob",
        name: null,
        avatar: null,
        image: "/bob.jpg",
        profileFrameId: "frame-1",
        usernameFont: null,
        phoneVerified: new Date(),
      },
    ]);

    const result = await getBlockedUsers();

    expect(result).toHaveLength(2);
    expect(result[0].username).toBe("alice");
    expect(result[1].username).toBe("bob");
  });

  it("queries users with correct select fields", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "me" } } as never);
    (mockPrisma.block.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { blockedId: "blocked1" },
    ]);
    (mockPrisma.phoneBlock.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    await getBlockedUsers();

    const findManyCall = (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(findManyCall.where.id).toEqual({ in: ["blocked1"] });
    expect(findManyCall.select).toEqual(expect.objectContaining({
      id: true,
      username: true,
      displayName: true,
      avatar: true,
      profileFrameId: true,
    }));
    expect(findManyCall.orderBy).toEqual({ username: "asc" });
  });

  it("returns JSON-serialized result", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "me" } } as never);
    (mockPrisma.block.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { blockedId: "blocked1" },
    ]);
    (mockPrisma.phoneBlock.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const dateObj = new Date("2026-01-01");
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "blocked1",
        username: "alice",
        displayName: "Alice",
        name: null,
        avatar: null,
        image: null,
        profileFrameId: null,
        usernameFont: null,
        phoneVerified: dateObj,
      },
    ]);

    const result = await getBlockedUsers();

    // Dates should be serialized to strings via JSON.parse(JSON.stringify())
    expect(typeof result[0].phoneVerified).toBe("string");
  });

  it("includes phone-blocked users in the list", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "me" } } as never);
    // Direct blocks
    (mockPrisma.block.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { blockedId: "direct-blocked" },
    ]);
    // Phone blocks
    (mockPrisma.phoneBlock.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { phoneNumber: "+1234567890" },
    ]);
    // Users matching phone block
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "phone-blocked" },
    ]);
    // Final findMany for user objects
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "direct-blocked",
        username: "directuser",
        displayName: "Direct",
        name: null,
        avatar: null,
        image: null,
        profileFrameId: null,
        usernameFont: null,
        phoneVerified: null,
      },
      {
        id: "phone-blocked",
        username: "phoneuser",
        displayName: "Phone",
        name: null,
        avatar: null,
        image: null,
        profileFrameId: null,
        usernameFont: null,
        phoneVerified: null,
      },
    ]);

    const result = await getBlockedUsers();

    expect(result).toHaveLength(2);
    const usernames = result.map((u: { username: string }) => u.username);
    expect(usernames).toContain("directuser");
    expect(usernames).toContain("phoneuser");
  });
});
