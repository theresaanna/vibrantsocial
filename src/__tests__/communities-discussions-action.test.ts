import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

vi.mock("@/app/feed/block-actions", () => ({
  getAllBlockRelatedIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/feed/feed-queries", () => ({
  getPostInclude: () => ({
    author: { select: { id: true, username: true, displayName: true, name: true, image: true, avatar: true, profileFrameId: true, usernameFont: true } },
    _count: { select: { comments: true, likes: true, bookmarks: true, reposts: true } },
    likes: { where: { userId: "" }, select: { id: true } },
    bookmarks: { where: { userId: "" }, select: { id: true } },
    reposts: { where: { userId: "" }, select: { id: true } },
    tags: { include: { tag: { select: { name: true } } } },
    wallPost: { select: { id: true, status: true, wallOwner: { select: { username: true, displayName: true } } } },
  }),
}));

describe("fetchTopDiscussedPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-27T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty posts array when no posts match", async () => {
    mockAuth.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);

    const { fetchTopDiscussedPosts } = await import("@/app/communities/discussion-actions");
    const result = await fetchTopDiscussedPosts();

    expect(result.posts).toEqual([]);
    expect(result.currentUserId).toBeNull();
  });

  it("queries posts from the past 7 days with comment count ordering", async () => {
    mockAuth.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);

    const { fetchTopDiscussedPosts } = await import("@/app/communities/discussion-actions");
    await fetchTopDiscussedPosts();

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const query = mockFindMany.mock.calls[0][0];

    // Should filter to past 7 days
    const since = new Date("2026-03-20T12:00:00Z");
    expect(query.where.createdAt.gte).toEqual(since);

    // Should order by comment count descending
    expect(query.orderBy).toEqual({ comments: { _count: "desc" } });

    // Should limit to 5
    expect(query.take).toBe(5);

    // Should require at least one comment
    expect(query.where.comments).toEqual({ some: {} });
  });

  it("excludes sensitive and graphic content", async () => {
    mockAuth.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);

    const { fetchTopDiscussedPosts } = await import("@/app/communities/discussion-actions");
    await fetchTopDiscussedPosts();

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.isSensitive).toBe(false);
    expect(query.where.isGraphicNudity).toBe(false);
  });

  it("excludes NSFW posts when user has showNsfwContent=false", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockFindUnique.mockResolvedValue({ showNsfwContent: false, ageVerified: false, showGraphicByDefault: false, phoneVerified: false });
    mockFindMany.mockResolvedValue([]);

    const { fetchTopDiscussedPosts } = await import("@/app/communities/discussion-actions");
    await fetchTopDiscussedPosts();

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.isNsfw).toBe(false);
    expect(query.where.NOT).toEqual({ tags: { some: { tag: { isNsfw: true } } } });
  });

  it("includes NSFW posts when user has showNsfwContent=true", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockFindUnique.mockResolvedValue({ showNsfwContent: true, ageVerified: true, showGraphicByDefault: true, phoneVerified: true });
    mockFindMany.mockResolvedValue([]);

    const { fetchTopDiscussedPosts } = await import("@/app/communities/discussion-actions");
    await fetchTopDiscussedPosts();

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.isNsfw).toBeUndefined();
    expect(query.where.NOT).toBeUndefined();
  });

  it("excludes close-friends-only and custom-audience posts", async () => {
    mockAuth.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);

    const { fetchTopDiscussedPosts } = await import("@/app/communities/discussion-actions");
    await fetchTopDiscussedPosts();

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.isCloseFriendsOnly).toBe(false);
    expect(query.where.hasCustomAudience).toBe(false);
  });

  it("only includes posts from public profiles", async () => {
    mockAuth.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);

    const { fetchTopDiscussedPosts } = await import("@/app/communities/discussion-actions");
    await fetchTopDiscussedPosts();

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.author.isProfilePublic).toBe(true);
  });

  it("eagerly includes comments in the query", async () => {
    mockAuth.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);

    const { fetchTopDiscussedPosts } = await import("@/app/communities/discussion-actions");
    await fetchTopDiscussedPosts();

    const query = mockFindMany.mock.calls[0][0];
    expect(query.include.comments).toBeDefined();
    expect(query.include.comments.include.author).toBeDefined();
    expect(query.include.comments.include.reactions).toBeDefined();
  });

  it("builds comment tree from flat comments", async () => {
    mockAuth.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([
      {
        id: "post1",
        content: "{}",
        createdAt: new Date("2026-03-27T10:00:00Z"),
        editedAt: null,
        isSensitive: false,
        isNsfw: false,
        isGraphicNudity: false,
        isPinned: false,
        author: { id: "a1", username: "alice" },
        _count: { comments: 2, likes: 0, bookmarks: 0, reposts: 0 },
        likes: [],
        bookmarks: [],
        reposts: [],
        tags: [],
        comments: [
          { id: "c1", parentId: null, content: "root", authorId: "a1", createdAt: new Date(), author: { id: "a1", username: "alice" }, reactions: [] },
          { id: "c2", parentId: "c1", content: "reply", authorId: "a2", createdAt: new Date(), author: { id: "a2", username: "bob" }, reactions: [{ emoji: "👍", userId: "a1" }] },
        ],
      },
    ]);

    const { fetchTopDiscussedPosts } = await import("@/app/communities/discussion-actions");
    const result = await fetchTopDiscussedPosts();

    expect(result.posts).toHaveLength(1);
    // Root comment should have reply nested
    const rootComment = result.posts[0].comments[0];
    expect(rootComment.id).toBe("c1");
    expect(rootComment.replies).toHaveLength(1);
    expect(rootComment.replies[0].id).toBe("c2");
    // Reactions should be grouped
    expect(rootComment.replies[0].reactions).toEqual([
      { emoji: "👍", userIds: ["a1"] },
    ]);
  });

  it("returns user settings when authenticated", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockFindUnique.mockResolvedValue({
      showNsfwContent: true,
      ageVerified: true,
      showGraphicByDefault: true,
      phoneVerified: true,
    });
    mockFindMany.mockResolvedValue([]);

    const { fetchTopDiscussedPosts } = await import("@/app/communities/discussion-actions");
    const result = await fetchTopDiscussedPosts();

    expect(result.currentUserId).toBe("user1");
    expect(result.phoneVerified).toBe(true);
    expect(result.ageVerified).toBe(true);
    expect(result.showGraphicByDefault).toBe(true);
    expect(result.showNsfwContent).toBe(true);
  });
});
