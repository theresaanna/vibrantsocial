import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFriends, getFriendsCount } from "@/app/feed/friend-actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    friendRequest: { findMany: vi.fn(), count: vi.fn() },
    follow: { findMany: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { send: vi.fn() },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

const makeUser = (id: string, username: string) => ({
  id,
  username,
  displayName: username.charAt(0).toUpperCase() + username.slice(1),
  name: null,
  avatar: null,
  image: null,
});

describe("getFriendsCount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns count of accepted friendships", async () => {
    mockPrisma.friendRequest.count.mockResolvedValueOnce(3 as never);
    const count = await getFriendsCount("user1");
    expect(count).toBe(3);
    expect(mockPrisma.friendRequest.count).toHaveBeenCalledWith({
      where: {
        status: "ACCEPTED",
        OR: [{ senderId: "user1" }, { receiverId: "user1" }],
      },
    });
  });

  it("returns 0 when no friends", async () => {
    mockPrisma.friendRequest.count.mockResolvedValueOnce(0 as never);
    const count = await getFriendsCount("user1");
    expect(count).toBe(0);
  });
});

describe("getFriends", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array for non-existent user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    const result = await getFriends("nonexistent");
    expect(result).toEqual([]);
  });

  it("returns friends from sender-side friendships", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "current" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user1" } as never);

    // user1 sent request to alice (so alice is the friend)
    mockPrisma.friendRequest.findMany.mockResolvedValueOnce([
      {
        senderId: "user1",
        receiverId: "alice-id",
        sender: makeUser("user1", "user1"),
        receiver: makeUser("alice-id", "alice"),
      },
    ] as never);

    // current user's follows
    mockPrisma.follow.findMany.mockResolvedValueOnce([
      { followingId: "alice-id" },
    ] as never);

    const result = await getFriends("testuser");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("alice-id");
    expect(result[0].username).toBe("alice");
    expect(result[0].isFollowing).toBe(true);
  });

  it("returns friends from receiver-side friendships", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "current" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user1" } as never);

    // bob sent request to user1 (so bob is the friend)
    mockPrisma.friendRequest.findMany.mockResolvedValueOnce([
      {
        senderId: "bob-id",
        receiverId: "user1",
        sender: makeUser("bob-id", "bob"),
        receiver: makeUser("user1", "user1"),
      },
    ] as never);

    mockPrisma.follow.findMany.mockResolvedValueOnce([] as never);

    const result = await getFriends("testuser");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("bob-id");
    expect(result[0].username).toBe("bob");
    expect(result[0].isFollowing).toBe(false);
  });

  it("returns empty array when user has no friends", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user1" } as never);
    mockPrisma.friendRequest.findMany.mockResolvedValueOnce([] as never);

    const result = await getFriends("testuser");
    expect(result).toEqual([]);
  });
});
