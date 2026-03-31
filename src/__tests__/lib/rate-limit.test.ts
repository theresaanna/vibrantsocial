import { describe, it, expect, vi, beforeEach } from "vitest";

// Undo the global mock from setup.ts so we can test the real module
vi.unmock("@/lib/rate-limit");

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@upstash/ratelimit", () => {
  const limit = vi.fn();
  class MockRatelimit {
    limit = limit;
    constructor() {}
    static slidingWindow() {
      return "sliding-window-config";
    }
  }
  return {
    Ratelimit: MockRatelimit,
    __mockLimit: limit,
  };
});

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      body,
      status: init?.status,
      headers: init?.headers,
    })),
  },
}));

import { checkRateLimit, uploadLimiter, apiLimiter, authLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { __mockLimit } from "@upstash/ratelimit";

const mockLimit = __mockLimit as ReturnType<typeof vi.fn>;
const mockNextResponseJson = vi.mocked(NextResponse.json);

describe("rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("limiter instances", () => {
    it("exports uploadLimiter", () => {
      expect(uploadLimiter).toBeDefined();
    });

    it("exports apiLimiter", () => {
      expect(apiLimiter).toBeDefined();
    });

    it("exports authLimiter", () => {
      expect(authLimiter).toBeDefined();
    });
  });

  describe("checkRateLimit", () => {
    it("returns null when rate limit is not exceeded", async () => {
      mockLimit.mockResolvedValueOnce({
        success: true,
        limit: 10,
        reset: 1000,
        remaining: 9,
      });

      const result = await checkRateLimit(uploadLimiter, "user1");
      expect(result).toBeNull();
      expect(mockLimit).toHaveBeenCalledWith("user1");
    });

    it("returns 429 response when rate limit is exceeded", async () => {
      mockLimit.mockResolvedValueOnce({
        success: false,
        limit: 10,
        reset: 1700000000,
        remaining: 0,
      });

      const fakeResponse = {
        body: { error: "Too many requests" },
        status: 429,
        headers: {
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": "1700000000",
        },
      };
      mockNextResponseJson.mockReturnValueOnce(fakeResponse as never);

      const result = await checkRateLimit(uploadLimiter, "user1");
      expect(result).not.toBeNull();
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": "1700000000",
          },
        }
      );
    });

    it("passes the correct identifier to the limiter", async () => {
      mockLimit.mockResolvedValueOnce({
        success: true,
        limit: 30,
        reset: 1000,
        remaining: 29,
      });

      await checkRateLimit(apiLimiter, "192.168.1.1");
      expect(mockLimit).toHaveBeenCalledWith("192.168.1.1");
    });
  });
});
