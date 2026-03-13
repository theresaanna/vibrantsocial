import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted to the top, so we cannot reference
// variables declared before them. Define mock fns inside the factory
// and export them so tests can access them.

vi.mock("@upstash/redis", () => {
  const get = vi.fn();
  const set = vi.fn();
  const del = vi.fn();
  const scan = vi.fn();
  return {
    Redis: vi.fn().mockImplementation(() => ({
      get,
      set,
      del,
      scan,
    })),
    __mockGet: get,
    __mockSet: set,
    __mockDel: del,
    __mockScan: scan,
  };
});

import { cached, invalidate, invalidatePattern, cacheKeys } from "@/lib/cache";
import {
  __mockGet,
  __mockSet,
  __mockDel,
  __mockScan,
} from "@upstash/redis";

const mockGet = __mockGet as ReturnType<typeof vi.fn>;
const mockSet = __mockSet as ReturnType<typeof vi.fn>;
const mockDel = __mockDel as ReturnType<typeof vi.fn>;
const mockScan = __mockScan as ReturnType<typeof vi.fn>;

describe("cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ── cached() ──────────────────────────────────────── */

  describe("cached", () => {
    it("returns cached value on cache hit", async () => {
      mockGet.mockResolvedValueOnce({ foo: "bar" });
      const fn = vi.fn();

      const result = await cached("mykey", fn, 60);
      expect(result).toEqual({ foo: "bar" });
      expect(fn).not.toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledWith("mykey");
    });

    it("calls fn and caches result on cache miss (null)", async () => {
      mockGet.mockResolvedValueOnce(null);
      mockSet.mockResolvedValueOnce("OK");
      const fn = vi.fn().mockResolvedValue({ computed: true });

      const result = await cached("mykey", fn, 120);
      expect(result).toEqual({ computed: true });
      expect(fn).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        "mykey",
        JSON.stringify({ computed: true }),
        { ex: 120 }
      );
    });

    it("calls fn and caches result on cache miss (undefined)", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      mockSet.mockResolvedValueOnce("OK");
      const fn = vi.fn().mockResolvedValue([1, 2, 3]);

      const result = await cached("mykey", fn, 30);
      expect(result).toEqual([1, 2, 3]);
      expect(fn).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        "mykey",
        JSON.stringify([1, 2, 3]),
        { ex: 30 }
      );
    });

    it("returns cached value for falsy non-null values (e.g. 0, empty string)", async () => {
      mockGet.mockResolvedValueOnce(0);
      const fn = vi.fn();

      const result = await cached("mykey", fn, 60);
      expect(result).toBe(0);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  /* ── invalidate() ──────────────────────────────────── */

  describe("invalidate", () => {
    it("deletes the specified cache key", async () => {
      mockDel.mockResolvedValueOnce(1);
      await invalidate("mykey");
      expect(mockDel).toHaveBeenCalledWith("mykey");
    });
  });

  /* ── invalidatePattern() ───────────────────────────── */

  describe("invalidatePattern", () => {
    it("scans and deletes matching keys", async () => {
      mockScan.mockResolvedValueOnce(["0", ["key1", "key2"]]);
      mockDel.mockResolvedValueOnce(2);

      await invalidatePattern("prefix:*");
      expect(mockScan).toHaveBeenCalledWith(0, { match: "prefix:*", count: 100 });
      expect(mockDel).toHaveBeenCalledWith("key1", "key2");
    });

    it("continues scanning until cursor is 0", async () => {
      mockScan.mockResolvedValueOnce(["5", ["key1"]]);
      mockDel.mockResolvedValueOnce(1);
      mockScan.mockResolvedValueOnce(["0", ["key2"]]);
      mockDel.mockResolvedValueOnce(1);

      await invalidatePattern("test:*");
      expect(mockScan).toHaveBeenCalledTimes(2);
      expect(mockDel).toHaveBeenCalledTimes(2);
      expect(mockDel).toHaveBeenCalledWith("key1");
      expect(mockDel).toHaveBeenCalledWith("key2");
    });

    it("does not call del when scan returns no keys", async () => {
      mockScan.mockResolvedValueOnce(["0", []]);

      await invalidatePattern("empty:*");
      expect(mockDel).not.toHaveBeenCalled();
    });
  });

  /* ── cacheKeys ─────────────────────────────────────── */

  describe("cacheKeys", () => {
    it("generates correct key for userFollowing", () => {
      expect(cacheKeys.userFollowing("u1")).toBe("user:u1:following");
    });

    it("generates correct key for userProfile", () => {
      expect(cacheKeys.userProfile("alice")).toBe("profile:alice");
    });

    it("generates correct key for postCounts", () => {
      expect(cacheKeys.postCounts("p1")).toBe("post:p1:counts");
    });

    it("generates correct key for tagCloud", () => {
      expect(cacheKeys.tagCloud()).toBe("tags:cloud");
    });

    it("generates correct key for nsfwTagCloud", () => {
      expect(cacheKeys.nsfwTagCloud()).toBe("tags:nsfw-cloud");
    });

    it("generates correct key for tagPostCount", () => {
      expect(cacheKeys.tagPostCount("react")).toBe("tag:react:count");
    });
  });
});
