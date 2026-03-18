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
    post: {
      findMany: vi.fn(),
    },
    repost: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    closeFriend: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  cacheKeys: {
    userFollowing: (id: string) => `user:${id}:following`,
    userBlockedIds: (id: string) => `user:${id}:blocked`,
    userProfile: (username: string) => `profile:${username}`,
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockGetAllBlockRelatedIds = vi.fn();
vi.mock("@/app/feed/block-actions", () => ({
  getAllBlockRelatedIds: (...args: unknown[]) => mockGetAllBlockRelatedIds(...args),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

describe("Feed filtering with blocked users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty items when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const result = await fetchFeedPage();
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("excludes blocked user IDs from followingIds used for post queries", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "me" } } as never);

    // User follows user2 (blocked) and user3 (not blocked)
    (mockPrisma.follow.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { followingId: "user2" },
      { followingId: "user3" },
    ] as never);

    // user2 is in block relationship
    mockGetAllBlockRelatedIds.mockResolvedValueOnce(["user2"]);

    // User preferences
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      showNsfwContent: false,
      ageVerified: false,
    } as never);

    // Close friends
    (mockPrisma.closeFriend.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);

    // Posts and reposts return empty
    (mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);
    (mockPrisma.repost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);

    await fetchFeedPage();

    // Verify posts query uses filtered followingIds (only user3, not user2)
    const postFindManyCall = (mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const authorIdFilter = postFindManyCall.where.authorId.in;
    expect(authorIdFilter).toContain("user3");
    expect(authorIdFilter).toContain("me"); // own posts always included
    expect(authorIdFilter).not.toContain("user2"); // blocked user excluded
  });

  it("excludes blocked user IDs from repost queries", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "me" } } as never);

    (mockPrisma.follow.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { followingId: "user2" },
      { followingId: "user3" },
    ] as never);

    mockGetAllBlockRelatedIds.mockResolvedValueOnce(["user2"]);

    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      showNsfwContent: false,
      ageVerified: false,
    } as never);

    (mockPrisma.closeFriend.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);

    (mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);
    (mockPrisma.repost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);

    await fetchFeedPage();

    const repostFindManyCall = (mockPrisma.repost.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const repostUserFilter = repostFindManyCall.where.userId.in;
    expect(repostUserFilter).toContain("user3");
    expect(repostUserFilter).not.toContain("user2");
  });

  it("returns posts only from non-blocked followed users", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "me" } } as never);

    (mockPrisma.follow.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { followingId: "user2" },
      { followingId: "user3" },
    ] as never);

    // Both user2 and user3 are blocked
    mockGetAllBlockRelatedIds.mockResolvedValueOnce(["user2", "user3"]);

    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      showNsfwContent: false,
      ageVerified: false,
    } as never);

    (mockPrisma.closeFriend.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);

    (mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);
    (mockPrisma.repost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);

    await fetchFeedPage();

    // When all followed users are blocked, only own user's posts should appear
    const postFindManyCall = (mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const authorIdFilter = postFindManyCall.where.authorId.in;
    expect(authorIdFilter).toEqual(["me"]);
  });

  it("calls getAllBlockRelatedIds with the current user id", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "me" } } as never);

    (mockPrisma.follow.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);
    mockGetAllBlockRelatedIds.mockResolvedValueOnce([]);

    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      showNsfwContent: false,
      ageVerified: false,
    } as never);

    (mockPrisma.closeFriend.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);

    (mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);
    (mockPrisma.repost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([] as never);

    await fetchFeedPage();

    expect(mockGetAllBlockRelatedIds).toHaveBeenCalledWith("me");
  });
});
