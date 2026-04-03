import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

const mockPostFindMany = vi.fn();
const mockUserFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findMany: (...args: unknown[]) => mockPostFindMany(...args) },
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
  },
}));

const mockGetAllBlockRelatedIds = vi.fn();
vi.mock("@/app/feed/block-actions", () => ({
  getAllBlockRelatedIds: (...args: unknown[]) => mockGetAllBlockRelatedIds(...args),
}));

vi.mock("@/lib/lexical-text", () => ({
  extractMediaFromLexicalJson: vi.fn((content: string) => {
    // Return media if content contains "has-media"
    if (content.includes("has-media")) return [{ type: "image", url: "test.jpg" }];
    return [];
  }),
}));

describe("fetchCommunitiesMediaPage block filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("does not filter when user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    mockPostFindMany.mockResolvedValue([]);

    const { fetchCommunitiesMediaPage } = await import("@/app/communities/media-actions");
    await fetchCommunitiesMediaPage();

    const query = mockPostFindMany.mock.calls[0][0];
    expect(query.where.authorId).toBeUndefined();
    expect(mockGetAllBlockRelatedIds).not.toHaveBeenCalled();
  });

  it("excludes blocked users from media posts when authenticated", async () => {
    mockAuth.mockResolvedValue({ user: { id: "me" } });
    mockUserFindUnique.mockResolvedValue({ showNsfwContent: false });
    mockGetAllBlockRelatedIds.mockResolvedValue(["blocked1", "blocked2"]);
    mockPostFindMany.mockResolvedValue([]);

    const { fetchCommunitiesMediaPage } = await import("@/app/communities/media-actions");
    await fetchCommunitiesMediaPage();

    const query = mockPostFindMany.mock.calls[0][0];
    expect(query.where.authorId).toEqual({ notIn: ["blocked1", "blocked2"] });
  });

  it("does not apply authorId filter when no blocks exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "me" } });
    mockUserFindUnique.mockResolvedValue({ showNsfwContent: false });
    mockGetAllBlockRelatedIds.mockResolvedValue([]);
    mockPostFindMany.mockResolvedValue([]);

    const { fetchCommunitiesMediaPage } = await import("@/app/communities/media-actions");
    await fetchCommunitiesMediaPage();

    const query = mockPostFindMany.mock.calls[0][0];
    expect(query.where.authorId).toBeUndefined();
  });

  it("calls getAllBlockRelatedIds with the correct user id", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-456" } });
    mockUserFindUnique.mockResolvedValue({ showNsfwContent: false });
    mockGetAllBlockRelatedIds.mockResolvedValue([]);
    mockPostFindMany.mockResolvedValue([]);

    const { fetchCommunitiesMediaPage } = await import("@/app/communities/media-actions");
    await fetchCommunitiesMediaPage();

    expect(mockGetAllBlockRelatedIds).toHaveBeenCalledWith("user-456");
  });

  it("still applies other filters alongside block filter", async () => {
    mockAuth.mockResolvedValue({ user: { id: "me" } });
    mockUserFindUnique.mockResolvedValue({ showNsfwContent: false });
    mockGetAllBlockRelatedIds.mockResolvedValue(["blocked1"]);
    mockPostFindMany.mockResolvedValue([]);

    const { fetchCommunitiesMediaPage } = await import("@/app/communities/media-actions");
    await fetchCommunitiesMediaPage();

    const query = mockPostFindMany.mock.calls[0][0];
    // Block filter present
    expect(query.where.authorId).toEqual({ notIn: ["blocked1"] });
    // Other filters still present
    expect(query.where.isSensitive).toBe(false);
    expect(query.where.isGraphicNudity).toBe(false);
    expect(query.where.isCloseFriendsOnly).toBe(false);
  });

  it("filters media posts from blocked users out of results", async () => {
    mockAuth.mockResolvedValue({ user: { id: "me" } });
    mockUserFindUnique.mockResolvedValue({ showNsfwContent: false });
    mockGetAllBlockRelatedIds.mockResolvedValue(["blocked1"]);

    // Simulating posts that have media
    mockPostFindMany.mockResolvedValue([
      {
        id: "p1",
        slug: "post-1",
        content: "has-media content",
        createdAt: new Date("2026-01-01"),
        author: { id: "user-ok", username: "gooduser" },
      },
    ]);

    const { fetchCommunitiesMediaPage } = await import("@/app/communities/media-actions");
    const result = await fetchCommunitiesMediaPage();

    // The blocked user's post should not appear because it was filtered at the query level
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].id).toBe("p1");
  });

  it("combines block filter with cursor-based pagination", async () => {
    mockAuth.mockResolvedValue({ user: { id: "me" } });
    mockUserFindUnique.mockResolvedValue({ showNsfwContent: false });
    mockGetAllBlockRelatedIds.mockResolvedValue(["blocked1"]);
    mockPostFindMany.mockResolvedValue([]);

    const cursor = "2026-01-15T00:00:00.000Z";
    const { fetchCommunitiesMediaPage } = await import("@/app/communities/media-actions");
    await fetchCommunitiesMediaPage(cursor);

    const query = mockPostFindMany.mock.calls[0][0];
    expect(query.where.authorId).toEqual({ notIn: ["blocked1"] });
    expect(query.where.createdAt).toBeDefined();
  });
});
