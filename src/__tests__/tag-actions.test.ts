import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tag: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    postTag: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user1" } }),
}));

vi.mock("@/app/feed/feed-queries", () => ({
  PAGE_SIZE: 10,
  getPostInclude: () => ({
    author: { select: { id: true } },
  }),
}));

vi.mock("@/lib/cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  cacheKeys: {
    tagCloud: () => "tagCloud",
    nsfwTagCloud: () => "nsfwTagCloud",
    allTagCloud: () => "allTagCloud",
    tagPostCount: (name: string) => `tagPostCount:${name}`,
  },
}));

import {
  searchTags,
  getTagCloudData,
  getNsfwTagCloudData,
  getAllTagCloudData,
  getPostsByTag,
} from "@/app/tags/actions";

const PUBLIC_AUTHOR = { author: { isProfilePublic: true } };

describe("searchTags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array for empty query", async () => {
    const result = await searchTags("");
    expect(result).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("returns tags matching the query with 2+ posts", async () => {
    mockFindMany.mockResolvedValue([
      { id: "t1", name: "react", _count: { posts: 5 } },
      { id: "t2", name: "reactnative", _count: { posts: 3 } },
      { id: "t3", name: "redux", _count: { posts: 1 } },
    ]);

    const result = await searchTags("rea");
    expect(result).toEqual([
      { id: "t1", name: "react", count: 5 },
      { id: "t2", name: "reactnative", count: 3 },
    ]);
  });

  it("filters out tags with only 1 post", async () => {
    mockFindMany.mockResolvedValue([
      { id: "t1", name: "once", _count: { posts: 1 } },
    ]);

    const result = await searchTags("once");
    expect(result).toEqual([]);
  });

  it("normalizes the query", async () => {
    mockFindMany.mockResolvedValue([]);
    await searchTags("#React");
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { startsWith: "react" },
        }),
      })
    );
  });

  it("limits to 10 results", async () => {
    const manyTags = Array.from({ length: 15 }, (_, i) => ({
      id: `t${i}`,
      name: `tag${i}`,
      _count: { posts: 10 },
    }));
    mockFindMany.mockResolvedValue(manyTags);

    const result = await searchTags("tag");
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("excludes NSFW posts by default and filters by public profile", async () => {
    mockFindMany.mockResolvedValue([]);

    await searchTags("test");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          posts: {
            some: {
              post: {
                isSensitive: false,
                isNsfw: false,
                isGraphicNudity: false,
                ...PUBLIC_AUTHOR,
              },
            },
          },
        }),
      })
    );
  });

  it("includes NSFW posts when includeNsfw is true but still filters by public profile", async () => {
    mockFindMany.mockResolvedValue([]);

    await searchTags("test", true);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          posts: {
            some: {
              post: {
                isSensitive: false,
                isGraphicNudity: false,
                ...PUBLIC_AUTHOR,
              },
            },
          },
        }),
      })
    );
  });
});

describe("getTagCloudData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tags sorted by count descending", async () => {
    mockFindMany.mockResolvedValue([
      { name: "alpha", _count: { posts: 2 } },
      { name: "beta", _count: { posts: 5 } },
      { name: "gamma", _count: { posts: 0 } },
    ]);

    const result = await getTagCloudData();
    expect(result).toEqual([
      { name: "beta", count: 5 },
      { name: "alpha", count: 2 },
    ]);
  });

  it("excludes tags with 0 posts", async () => {
    mockFindMany.mockResolvedValue([
      { name: "empty", _count: { posts: 0 } },
    ]);

    const result = await getTagCloudData();
    expect(result).toEqual([]);
  });

  it("filters by public profile in post count query", async () => {
    mockFindMany.mockResolvedValue([]);

    await getTagCloudData();

    const call = mockFindMany.mock.calls[0][0];
    const postFilter = call.select._count.select.posts.where.post;
    expect(postFilter).toMatchObject({
      isSensitive: false,
      isNsfw: false,
      isGraphicNudity: false,
      ...PUBLIC_AUTHOR,
    });
  });
});

describe("getNsfwTagCloudData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters by NSFW tags or posts with isNsfw: true", async () => {
    mockFindMany.mockResolvedValue([]);

    await getNsfwTagCloudData();

    const call = mockFindMany.mock.calls[0][0];
    // Should use OR to match tags flagged as NSFW or tags with NSFW posts
    expect(call.where.OR).toBeDefined();
    expect(call.where.OR).toEqual(
      expect.arrayContaining([
        { isNsfw: true },
        expect.objectContaining({
          posts: expect.objectContaining({
            some: expect.objectContaining({
              post: expect.objectContaining({ isNsfw: true }),
            }),
          }),
        }),
      ])
    );
    // Post count filter should exclude sensitive/graphic but include all others
    const postFilter = call.select._count.select.posts.where.post;
    expect(postFilter).toMatchObject({
      isSensitive: false,
      isGraphicNudity: false,
      ...PUBLIC_AUTHOR,
    });
  });

  it("excludes tags with 0 NSFW posts", async () => {
    mockFindMany.mockResolvedValue([
      { name: "has-nsfw", _count: { posts: 3 } },
      { name: "no-nsfw", _count: { posts: 0 } },
    ]);

    const result = await getNsfwTagCloudData();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("has-nsfw");
  });

  it("sorts results by count descending", async () => {
    mockFindMany.mockResolvedValue([
      { name: "small", _count: { posts: 1 } },
      { name: "big", _count: { posts: 10 } },
    ]);

    const result = await getNsfwTagCloudData();
    expect(result.map((t) => t.name)).toEqual(["big", "small"]);
  });
});

describe("getAllTagCloudData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all tags including NSFW sorted by count descending", async () => {
    mockFindMany.mockResolvedValue([
      { name: "sfw-tag", _count: { posts: 3 } },
      { name: "nsfw-tag", _count: { posts: 7 } },
      { name: "another", _count: { posts: 1 } },
    ]);

    const result = await getAllTagCloudData();
    expect(result).toEqual([
      { name: "nsfw-tag", count: 7 },
      { name: "sfw-tag", count: 3 },
      { name: "another", count: 1 },
    ]);
  });

  it("excludes tags with 0 posts", async () => {
    mockFindMany.mockResolvedValue([
      { name: "empty", _count: { posts: 0 } },
      { name: "has-posts", _count: { posts: 2 } },
    ]);

    const result = await getAllTagCloudData();
    expect(result).toEqual([{ name: "has-posts", count: 2 }]);
  });

  it("does not filter by isNsfw on the tag level", async () => {
    mockFindMany.mockResolvedValue([]);

    await getAllTagCloudData();

    const call = mockFindMany.mock.calls[0][0];
    // Should not have isNsfw filter at the tag level
    expect(call.where).toBeUndefined();
  });

  it("excludes sensitive and graphic posts but includes NSFW posts", async () => {
    mockFindMany.mockResolvedValue([]);

    await getAllTagCloudData();

    const call = mockFindMany.mock.calls[0][0];
    const postFilter = call.select._count.select.posts.where.post;
    expect(postFilter).toMatchObject({
      isSensitive: false,
      isGraphicNudity: false,
      ...PUBLIC_AUTHOR,
    });
    // Should NOT have isNsfw: false — NSFW posts are included
    expect(postFilter.isNsfw).toBeUndefined();
  });

  it("filters by public profiles", async () => {
    mockFindMany.mockResolvedValue([]);

    await getAllTagCloudData();

    const call = mockFindMany.mock.calls[0][0];
    const postFilter = call.select._count.select.posts.where.post;
    expect(postFilter.author).toEqual({ isProfilePublic: true });
  });
});

describe("getPostsByTag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result for empty tag name", async () => {
    const result = await getPostsByTag("");
    expect(result).toEqual({ posts: [], hasMore: false, totalCount: 0 });
  });

  it("filters count query by public profile (SFW)", async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    await getPostsByTag("react");

    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          post: {
            isSensitive: false,
            isNsfw: false,
            isGraphicNudity: false,
            ...PUBLIC_AUTHOR,
          },
        }),
      })
    );
  });

  it("filters findMany query by public profile (SFW)", async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    await getPostsByTag("react");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          post: {
            isSensitive: false,
            isNsfw: false,
            isGraphicNudity: false,
            ...PUBLIC_AUTHOR,
          },
        }),
      })
    );
  });

  it("includes NSFW posts when includeNsfw is true but still filters by public profile", async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    await getPostsByTag("react", undefined, undefined, true);

    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          post: {
            isSensitive: false,
            isGraphicNudity: false,
            ...PUBLIC_AUTHOR,
          },
        }),
      })
    );
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          post: {
            isSensitive: false,
            isGraphicNudity: false,
            ...PUBLIC_AUTHOR,
          },
        }),
      })
    );
  });

  it("returns hasMore: true when results exceed PAGE_SIZE", async () => {
    const posts = Array.from({ length: 11 }, (_, i) => ({
      id: `pt${i}`,
      post: { id: `p${i}`, content: "test" },
    }));
    mockCount.mockResolvedValue(15);
    mockFindMany.mockResolvedValue(posts);

    const result = await getPostsByTag("react");

    expect(result.hasMore).toBe(true);
    expect(result.posts).toHaveLength(10);
    expect(result.totalCount).toBe(15);
  });

  it("returns hasMore: false when results fit within PAGE_SIZE", async () => {
    const posts = Array.from({ length: 3 }, (_, i) => ({
      id: `pt${i}`,
      post: { id: `p${i}`, content: "test" },
    }));
    mockCount.mockResolvedValue(3);
    mockFindMany.mockResolvedValue(posts);

    const result = await getPostsByTag("react");

    expect(result.hasMore).toBe(false);
    expect(result.posts).toHaveLength(3);
  });

  it("passes cursor for pagination", async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    await getPostsByTag("react", "user1", "cursor-id");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "cursor-id" },
        skip: 1,
      })
    );
  });
});
