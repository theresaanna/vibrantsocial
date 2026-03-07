import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFollowers, getFollowing } from "@/app/feed/follow-actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    follow: { findMany: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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

describe("getFollowers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array for non-existent user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    const result = await getFollowers("nonexistent");
    expect(result).toEqual([]);
  });

  it("returns followers with isFollowing status", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "current" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user1" } as never);

    mockPrisma.follow.findMany
      // getFollowers query
      .mockResolvedValueOnce([
        { follower: makeUser("f1", "alice") },
        { follower: makeUser("f2", "bob") },
      ] as never)
      // current user's follows query
      .mockResolvedValueOnce([
        { followingId: "f1" },
      ] as never);

    const result = await getFollowers("testuser");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("f1");
    expect(result[0].username).toBe("alice");
    expect(result[0].isFollowing).toBe(true);
    expect(result[1].id).toBe("f2");
    expect(result[1].isFollowing).toBe(false);
  });

  it("returns followers without isFollowing when not logged in", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user1" } as never);

    mockPrisma.follow.findMany.mockResolvedValueOnce([
      { follower: makeUser("f1", "alice") },
    ] as never);

    const result = await getFollowers("testuser");
    expect(result).toHaveLength(1);
    expect(result[0].isFollowing).toBe(false);
  });
});

describe("getFollowing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array for non-existent user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    const result = await getFollowing("nonexistent");
    expect(result).toEqual([]);
  });

  it("returns following users with isFollowing status", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "current" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user1" } as never);

    mockPrisma.follow.findMany
      .mockResolvedValueOnce([
        { following: makeUser("f1", "alice") },
        { following: makeUser("f2", "bob") },
      ] as never)
      .mockResolvedValueOnce([
        { followingId: "f1" },
        { followingId: "f2" },
      ] as never);

    const result = await getFollowing("testuser");
    expect(result).toHaveLength(2);
    expect(result[0].isFollowing).toBe(true);
    expect(result[1].isFollowing).toBe(true);
  });

  it("returns empty array when user has no following", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user1" } as never);
    mockPrisma.follow.findMany.mockResolvedValueOnce([] as never);

    const result = await getFollowing("testuser");
    expect(result).toEqual([]);
  });
});
