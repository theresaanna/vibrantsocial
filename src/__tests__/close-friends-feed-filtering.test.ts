import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchFeedPage } from "@/app/feed/feed-actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    follow: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    post: {
      findMany: vi.fn(),
    },
    repost: {
      findMany: vi.fn(),
    },
    closeFriend: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  cacheKeys: {
    userFollowing: (userId: string) => `user:${userId}:following`,
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

describe("fetchFeedPage close-friends-only filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty items if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await fetchFeedPage();
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("includes close-friends-only filter in post queries", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    // Following user2
    mockPrisma.follow.findMany.mockResolvedValueOnce([
      { followingId: "user2" },
    ] as never);

    // User preferences
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      showNsfwContent: false,
      ageVerified: null,
    } as never);

    // user3 has user1 on their close friends list
    mockPrisma.closeFriend.findMany.mockResolvedValueOnce([
      { userId: "user3" },
    ] as never);

    // No posts or reposts
    mockPrisma.post.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.repost.findMany.mockResolvedValueOnce([] as never);

    await fetchFeedPage();

    // Verify post query includes close friends OR filter
    const postQueryCall = mockPrisma.post.findMany.mock.calls[0][0];
    expect(postQueryCall?.where).toHaveProperty("OR");
    const orClause = (postQueryCall?.where as Record<string, unknown>).OR as Array<Record<string, unknown>>;
    expect(orClause).toHaveLength(2);
    expect(orClause[0]).toEqual({ isCloseFriendsOnly: false });
    expect(orClause[1]).toEqual({
      isCloseFriendsOnly: true,
      authorId: { in: ["user3", "user1"] }, // closeFriendOf + self
    });

    // Verify repost query includes close friends OR filter
    const repostQueryCall = mockPrisma.repost.findMany.mock.calls[0][0];
    expect(repostQueryCall?.where).toHaveProperty("OR");
    const repostOrClause = (repostQueryCall?.where as Record<string, unknown>).OR as Array<Record<string, unknown>>;
    expect(repostOrClause).toHaveLength(2);
    expect(repostOrClause[0]).toEqual({ isCloseFriendsOnly: false });
    expect(repostOrClause[1]).toEqual({
      isCloseFriendsOnly: true,
      userId: { in: ["user3", "user1"] },
    });
  });

  it("includes own close-friends-only posts in feed", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    mockPrisma.follow.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      showNsfwContent: false,
      ageVerified: null,
    } as never);
    mockPrisma.closeFriend.findMany.mockResolvedValueOnce([] as never);

    // Return a close-friends-only post by user1
    const closeFriendsPost = {
      id: "post1",
      content: "secret post",
      authorId: "user1",
      isCloseFriendsOnly: true,
      isSensitive: false,
      isNsfw: false,
      isGraphicNudity: false,
      createdAt: new Date("2025-01-01"),
      author: { id: "user1", username: "me", displayName: "Me", name: null, image: null, avatar: null },
      _count: { comments: 0, likes: 0, bookmarks: 0, reposts: 0 },
      likes: [],
      bookmarks: [],
      reposts: [],
      tags: [],
    };
    mockPrisma.post.findMany.mockResolvedValueOnce([closeFriendsPost] as never);
    mockPrisma.repost.findMany.mockResolvedValueOnce([] as never);

    const result = await fetchFeedPage();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].data.isCloseFriendsOnly).toBe(true);
  });

  it("uses cursor for pagination with close friends filter", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.follow.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      showNsfwContent: false,
      ageVerified: null,
    } as never);
    mockPrisma.closeFriend.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.post.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.repost.findMany.mockResolvedValueOnce([] as never);

    const cursor = "2025-01-15T00:00:00.000Z";
    await fetchFeedPage(cursor);

    const postQueryCall = mockPrisma.post.findMany.mock.calls[0][0];
    expect(postQueryCall?.where).toHaveProperty("createdAt");
    expect(postQueryCall?.where).toHaveProperty("OR");
  });
});
