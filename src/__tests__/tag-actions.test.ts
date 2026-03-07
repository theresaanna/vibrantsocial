import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockFindUnique = vi.fn();

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

import { searchTags, getTagCloudData } from "@/app/tags/actions";

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
});
