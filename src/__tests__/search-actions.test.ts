import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    post: { findMany: vi.fn() },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchUsers, searchPosts } from "@/app/search/actions";
import { PAGE_SIZE } from "@/app/feed/feed-queries";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

function mockSession(userId = "user1") {
  mockAuth.mockResolvedValueOnce({ user: { id: userId } } as never);
}

describe("searchUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await searchUsers("alice");
    expect(result).toEqual({ users: [], hasMore: false });
  });

  it("returns empty for empty query", async () => {
    mockSession();
    const result = await searchUsers("");
    expect(result).toEqual({ users: [], hasMore: false });
  });

  it("returns empty for single character query", async () => {
    mockSession();
    const result = await searchUsers("a");
    expect(result).toEqual({ users: [], hasMore: false });
  });

  it("returns empty for whitespace-only query", async () => {
    mockSession();
    const result = await searchUsers("   ");
    expect(result).toEqual({ users: [], hasMore: false });
  });

  it("searches username, displayName, and name with insensitive contains", async () => {
    mockSession();
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);

    await searchUsers("alice");

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { username: { contains: "alice", mode: "insensitive" } },
            { displayName: { contains: "alice", mode: "insensitive" } },
            { name: { contains: "alice", mode: "insensitive" } },
          ],
        },
      })
    );
  });

  it("fetches PAGE_SIZE + 1 to determine hasMore", async () => {
    mockSession();
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);

    await searchUsers("alice");

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: PAGE_SIZE + 1,
      })
    );
  });

  it("returns hasMore=true and trims results when more than PAGE_SIZE", async () => {
    mockSession();
    const users = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({
      id: `user${i}`,
      username: `user${i}`,
      displayName: null,
      name: null,
      avatar: null,
      image: null,
      bio: null,
      _count: { followers: 0, posts: 0 },
    }));
    mockPrisma.user.findMany.mockResolvedValueOnce(users as never);

    const result = await searchUsers("user");

    expect(result.hasMore).toBe(true);
    expect(result.users).toHaveLength(PAGE_SIZE);
  });

  it("returns hasMore=false when fewer results than PAGE_SIZE", async () => {
    mockSession();
    const users = [
      {
        id: "user1",
        username: "alice",
        displayName: "Alice",
        name: null,
        avatar: null,
        image: null,
        bio: "Hello",
        _count: { followers: 5, posts: 10 },
      },
    ];
    mockPrisma.user.findMany.mockResolvedValueOnce(users as never);

    const result = await searchUsers("alice");

    expect(result.hasMore).toBe(false);
    expect(result.users).toHaveLength(1);
    expect(result.users[0].username).toBe("alice");
  });

  it("passes cursor for pagination", async () => {
    mockSession();
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);

    await searchUsers("alice", "cursor-id");

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "cursor-id" },
        skip: 1,
      })
    );
  });

  it("does not include cursor params when no cursor provided", async () => {
    mockSession();
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);

    await searchUsers("alice");

    const call = mockPrisma.user.findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(call.cursor).toBeUndefined();
    expect(call.skip).toBeUndefined();
  });

  it("trims whitespace from query", async () => {
    mockSession();
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);

    await searchUsers("  alice  ");

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { username: { contains: "alice", mode: "insensitive" } },
          ]),
        }),
      })
    );
  });

  it("selects bio and counts for rich result cards", async () => {
    mockSession();
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);

    await searchUsers("alice");

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          bio: true,
          _count: { select: { followers: true, posts: true } },
        }),
      })
    );
  });
});

describe("searchPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await searchPosts("hello");
    expect(result).toEqual({ posts: [], hasMore: false });
  });

  it("returns empty for empty query", async () => {
    mockSession();
    const result = await searchPosts("");
    expect(result).toEqual({ posts: [], hasMore: false });
  });

  it("returns empty for single character query", async () => {
    mockSession();
    const result = await searchPosts("h");
    expect(result).toEqual({ posts: [], hasMore: false });
  });

  it("returns empty for whitespace-only query", async () => {
    mockSession();
    const result = await searchPosts("   ");
    expect(result).toEqual({ posts: [], hasMore: false });
  });

  it("searches content with insensitive contains", async () => {
    mockSession();
    mockPrisma.post.findMany.mockResolvedValueOnce([] as never);

    await searchPosts("hello world");

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          content: { contains: "hello world", mode: "insensitive" },
        }),
      })
    );
  });

  it("orders results by createdAt desc", async () => {
    mockSession();
    mockPrisma.post.findMany.mockResolvedValueOnce([] as never);

    await searchPosts("hello");

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("includes author and interaction data via postInclude", async () => {
    mockSession();
    mockPrisma.post.findMany.mockResolvedValueOnce([] as never);

    await searchPosts("hello");

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          author: expect.any(Object),
          _count: expect.any(Object),
          likes: expect.any(Object),
          bookmarks: expect.any(Object),
          reposts: expect.any(Object),
          comments: expect.any(Object),
        }),
      })
    );
  });

  it("returns hasMore=true and trims results when more than PAGE_SIZE", async () => {
    mockSession();
    const posts = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({
      id: `post${i}`,
      content: "hello",
      createdAt: new Date(),
      author: { id: "a1" },
    }));
    mockPrisma.post.findMany.mockResolvedValueOnce(posts as never);

    const result = await searchPosts("hello");

    expect(result.hasMore).toBe(true);
    expect(result.posts).toHaveLength(PAGE_SIZE);
  });

  it("returns hasMore=false when fewer results", async () => {
    mockSession();
    const posts = [{ id: "post1", content: "hello", createdAt: new Date() }];
    mockPrisma.post.findMany.mockResolvedValueOnce(posts as never);

    const result = await searchPosts("hello");

    expect(result.hasMore).toBe(false);
    expect(result.posts).toHaveLength(1);
  });

  it("filters by createdAt when cursor provided", async () => {
    mockSession();
    mockPrisma.post.findMany.mockResolvedValueOnce([] as never);

    const cursor = "2025-01-15T12:00:00.000Z";
    await searchPosts("hello", cursor);

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { lt: new Date(cursor) },
        }),
      })
    );
  });

  it("does not include createdAt filter when no cursor", async () => {
    mockSession();
    mockPrisma.post.findMany.mockResolvedValueOnce([] as never);

    await searchPosts("hello");

    const call = mockPrisma.post.findMany.mock.calls[0][0] as Record<string, unknown>;
    const where = call.where as Record<string, unknown>;
    expect(where.createdAt).toBeUndefined();
  });

  it("trims whitespace from query", async () => {
    mockSession();
    mockPrisma.post.findMany.mockResolvedValueOnce([] as never);

    await searchPosts("  hello  ");

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          content: { contains: "hello", mode: "insensitive" },
        }),
      })
    );
  });
});
