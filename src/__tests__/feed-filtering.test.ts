import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchFeedPage } from "@/app/feed/feed-actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    repost: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    follow: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    closeFriend: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  cacheKeys: {
    userFollowing: (id: string) => `following:${id}`,
  },
}));

vi.mock("@/app/feed/feed-queries", () => ({
  getPostInclude: vi.fn().mockReturnValue({}),
  getRepostInclude: vi.fn().mockReturnValue({}),
  repostUserSelect: {},
  PAGE_SIZE: 10,
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

describe("fetchFeedPage content filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.follow.findMany.mockResolvedValue([]);
    mockPrisma.post.findMany.mockResolvedValue([]);
    mockPrisma.repost.findMany.mockResolvedValue([]);
  });

  it("returns empty items when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await fetchFeedPage();
    expect(result).toEqual({ items: [], hasMore: false });
  });

  it("excludes sensitive and graphic/nudity posts when user is not age verified", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      showNsfwContent: false,
      ageVerified: null,
    } as never);

    await fetchFeedPage();

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isSensitive: false,
          isGraphicNudity: false,
          isNsfw: false,
        }),
      })
    );
  });

  it("does not filter sensitive/graphic posts when user is age verified", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      showNsfwContent: false,
      ageVerified: new Date(),
    } as never);

    await fetchFeedPage();

    const callArgs = mockPrisma.post.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArgs.where).not.toHaveProperty("isSensitive");
    expect(callArgs.where).not.toHaveProperty("isGraphicNudity");
    // NSFW should still be filtered since showNsfwContent is false
    expect(callArgs.where).toHaveProperty("isNsfw", false);
  });

  it("excludes NSFW posts when user has not opted in", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      showNsfwContent: false,
      ageVerified: new Date(),
    } as never);

    await fetchFeedPage();

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isNsfw: false,
        }),
      })
    );
  });

  it("includes NSFW posts when user has opted in", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      showNsfwContent: true,
      ageVerified: new Date(),
    } as never);

    await fetchFeedPage();

    const callArgs = mockPrisma.post.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArgs.where).not.toHaveProperty("isNsfw");
  });

  it("applies both NSFW and age verification filters for non-verified non-opted-in user", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      showNsfwContent: false,
      ageVerified: null,
    } as never);

    await fetchFeedPage();

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isNsfw: false,
          isSensitive: false,
          isGraphicNudity: false,
        }),
      })
    );
  });

  it("age verified + NSFW opted in sees all content types", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      showNsfwContent: true,
      ageVerified: new Date(),
    } as never);

    await fetchFeedPage();

    const callArgs = mockPrisma.post.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArgs.where).not.toHaveProperty("isNsfw");
    expect(callArgs.where).not.toHaveProperty("isSensitive");
    expect(callArgs.where).not.toHaveProperty("isGraphicNudity");
  });
});
