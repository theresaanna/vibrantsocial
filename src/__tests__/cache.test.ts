import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();
const mockScan = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: mockGet,
    set: mockSet,
    del: mockDel,
    scan: mockScan,
  })),
}));

// Set env vars before importing
process.env.UPSTASH_REDIS_REST_URL = "https://fake-redis.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

const { cached, getCached, invalidate, invalidatePattern, invalidateMany, cacheKeys } =
  await import("@/lib/cache");

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// cached
// ---------------------------------------------------------------------------

describe("cached", () => {
  it("returns cached value on hit", async () => {
    mockGet.mockResolvedValue({ name: "cached-data" });

    const fn = vi.fn();
    const result = await cached("test-key", fn, 60);

    expect(result).toEqual({ name: "cached-data" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("calls fn and caches result on miss", async () => {
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue("OK");

    const fn = vi.fn().mockResolvedValue({ name: "fresh-data" });
    const result = await cached("test-key", fn, 120);

    expect(result).toEqual({ name: "fresh-data" });
    expect(fn).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledWith(
      "test-key",
      JSON.stringify({ name: "fresh-data" }),
      { ex: 120 }
    );
  });

  it("calls fn on undefined cache value", async () => {
    mockGet.mockResolvedValue(undefined);
    mockSet.mockResolvedValue("OK");

    const fn = vi.fn().mockResolvedValue(42);
    const result = await cached("key", fn, 10);

    expect(result).toBe(42);
    expect(fn).toHaveBeenCalled();
  });

  it("uses the correct TTL", async () => {
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue("OK");

    await cached("key", async () => "val", 300);

    expect(mockSet).toHaveBeenCalledWith("key", '"val"', { ex: 300 });
  });
});

// ---------------------------------------------------------------------------
// getCached
// ---------------------------------------------------------------------------

describe("getCached", () => {
  it("returns cached value when present", async () => {
    mockGet.mockResolvedValue("hello");

    const result = await getCached("key");
    expect(result).toBe("hello");
    expect(mockGet).toHaveBeenCalledWith("key");
  });

  it("returns null on cache miss", async () => {
    mockGet.mockResolvedValue(null);

    const result = await getCached("missing-key");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// invalidate
// ---------------------------------------------------------------------------

describe("invalidate", () => {
  it("deletes the key from Redis", async () => {
    mockDel.mockResolvedValue(1);

    await invalidate("test-key");
    expect(mockDel).toHaveBeenCalledWith("test-key");
  });
});

// ---------------------------------------------------------------------------
// invalidatePattern
// ---------------------------------------------------------------------------

describe("invalidatePattern", () => {
  it("scans and deletes matching keys", async () => {
    // Cursor "0" on return means scan is complete
    mockScan.mockResolvedValueOnce(["0", ["key1", "key2"]]);
    mockDel.mockResolvedValue(2);

    await invalidatePattern("prefix:*");

    expect(mockScan).toHaveBeenCalledWith(0, { match: "prefix:*", count: 100 });
    expect(mockDel).toHaveBeenCalledWith("key1", "key2");
  });

  it("handles multiple scan iterations", async () => {
    // First scan returns cursor 42 (not done), second returns cursor 0 (done)
    mockScan
      .mockResolvedValueOnce(["42", ["key1"]])
      .mockResolvedValueOnce(["0", ["key2"]]);
    mockDel.mockResolvedValue(1);

    await invalidatePattern("test:*");

    expect(mockScan).toHaveBeenCalledTimes(2);
    expect(mockDel).toHaveBeenCalledWith("key1");
    expect(mockDel).toHaveBeenCalledWith("key2");
  });

  it("does not call del when no keys match", async () => {
    mockScan.mockResolvedValueOnce(["0", []]);

    await invalidatePattern("nonexistent:*");

    expect(mockDel).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// invalidateMany
// ---------------------------------------------------------------------------

describe("invalidateMany", () => {
  it("deletes multiple keys at once", async () => {
    mockDel.mockResolvedValue(3);

    await invalidateMany(["key1", "key2", "key3"]);
    expect(mockDel).toHaveBeenCalledWith("key1", "key2", "key3");
  });

  it("does nothing for empty array", async () => {
    await invalidateMany([]);
    expect(mockDel).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// cacheKeys
// ---------------------------------------------------------------------------

describe("cacheKeys", () => {
  it("generates correct user following key", () => {
    expect(cacheKeys.userFollowing("u1")).toBe("user:u1:following");
  });

  it("generates correct profile key", () => {
    expect(cacheKeys.userProfile("alice")).toBe("profile:alice");
  });

  it("generates correct post counts key", () => {
    expect(cacheKeys.postCounts("p1")).toBe("post:p1:counts");
  });

  it("generates correct tag cloud keys", () => {
    expect(cacheKeys.tagCloud()).toBe("tags:cloud");
    expect(cacheKeys.nsfwTagCloud()).toBe("tags:nsfw-cloud");
    expect(cacheKeys.allTagCloud()).toBe("tags:all-cloud");
  });

  it("generates correct tag post count key", () => {
    expect(cacheKeys.tagPostCount("javascript")).toBe("tag:javascript:count");
  });

  it("generates correct block keys", () => {
    expect(cacheKeys.userBlockedIds("u1")).toBe("user:u1:blocked");
    expect(cacheKeys.userBlockedByIds("u1")).toBe("user:u1:blocked-by");
    expect(cacheKeys.userAllBlocks("u1")).toBe("user:u1:all-blocks");
  });

  it("generates canonical friendship key regardless of order", () => {
    const key1 = cacheKeys.friendshipStatus("aaa", "zzz");
    const key2 = cacheKeys.friendshipStatus("zzz", "aaa");
    expect(key1).toBe(key2);
    expect(key1).toBe("friendship:aaa:zzz");
  });

  it("generates correct link preview key", () => {
    expect(cacheKeys.linkPreview("https://example.com")).toBe(
      "linkpreview:https://example.com"
    );
  });

  it("generates correct list keys", () => {
    expect(cacheKeys.userLists("u1")).toBe("user:u1:lists");
    expect(cacheKeys.userListMembers("l1")).toBe("list:l1:members");
    expect(cacheKeys.userListSubscriptions("u1")).toBe("user:u1:list-subs");
    expect(cacheKeys.userListCollaborators("l1")).toBe("list:l1:collaborators");
  });

  it("generates correct notification keys", () => {
    expect(cacheKeys.userNotifications("u1")).toBe("user:u1:notifications");
    expect(cacheKeys.unreadNotificationCount("u1")).toBe(
      "user:u1:unread-notif-count"
    );
  });

  it("generates correct search keys", () => {
    expect(cacheKeys.userSearch("u1", "test")).toBe("search:users:u1:test");
    expect(cacheKeys.postSearch("u1", "test")).toBe("search:posts:u1:test");
  });

  it("generates correct tag search keys with NSFW flag", () => {
    expect(cacheKeys.tagSearch("tag", true)).toBe("search:tags:tag:1");
    expect(cacheKeys.tagSearch("tag", false)).toBe("search:tags:tag:0");
  });

  it("generates correct close friends keys", () => {
    expect(cacheKeys.userCloseFriendIds("u1")).toBe("user:u1:close-friend-ids");
    expect(cacheKeys.userCloseFriendOf("u1")).toBe("user:u1:close-friend-of");
  });

  it("generates correct feed summary key", () => {
    expect(cacheKeys.feedSummary("u1")).toBe("user:u1:feed-summary");
  });

  it("generates correct conversation key", () => {
    expect(cacheKeys.userConversations("u1")).toBe("user:u1:conversations");
  });

  it("generates correct comment count key", () => {
    expect(cacheKeys.commentCount("p1")).toBe("post:p1:comment-count");
  });
});
