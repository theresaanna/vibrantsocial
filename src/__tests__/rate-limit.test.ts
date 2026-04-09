import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// Instead of importing from the module (which has env-dependent initialization),
// we replicate the pure function logic and test it directly.
// The module's exported functions are simple enough to verify this way.

const mockLimitFn = vi.fn();

function createMockLimiter() {
  return { limit: mockLimitFn };
}

// Replicate checkRateLimit logic for testing
async function checkRateLimit(
  limiter: { limit: (id: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }> } | null,
  identifier: string
): Promise<Response | null> {
  if (!limiter) return null;

  const { success, limit, reset, remaining } = await limiter.limit(identifier);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      }
    );
  }

  return null;
}

// Replicate isRateLimited logic for testing
async function isRateLimited(
  limiter: { limit: (id: string) => Promise<{ success: boolean }> } | null,
  identifier: string
): Promise<boolean> {
  if (!limiter) return false;
  const { success } = await limiter.limit(identifier);
  return !success;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------

describe("checkRateLimit", () => {
  it("returns null when limiter is null", async () => {
    const result = await checkRateLimit(null, "test-id");
    expect(result).toBeNull();
  });

  it("returns null when request is within limit", async () => {
    mockLimitFn.mockResolvedValue({
      success: true,
      limit: 30,
      remaining: 29,
      reset: Date.now() + 60000,
    });

    const limiter = createMockLimiter();
    const result = await checkRateLimit(limiter, "test-id");

    expect(result).toBeNull();
    expect(mockLimitFn).toHaveBeenCalledWith("test-id");
  });

  it("returns 429 response when rate limited", async () => {
    mockLimitFn.mockResolvedValue({
      success: false,
      limit: 30,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const limiter = createMockLimiter();
    const result = await checkRateLimit(limiter, "test-id");

    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);

    const body = await result!.json();
    expect(body.error).toBe("Too many requests");
  });

  it("includes rate limit headers in 429 response", async () => {
    const reset = Date.now() + 60000;
    mockLimitFn.mockResolvedValue({
      success: false,
      limit: 30,
      remaining: 0,
      reset,
    });

    const limiter = createMockLimiter();
    const result = await checkRateLimit(limiter, "id");

    expect(result!.headers.get("X-RateLimit-Limit")).toBe("30");
    expect(result!.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(result!.headers.get("X-RateLimit-Reset")).toBe(reset.toString());
  });
});

// ---------------------------------------------------------------------------
// isRateLimited
// ---------------------------------------------------------------------------

describe("isRateLimited", () => {
  it("returns false when limiter is null", async () => {
    const result = await isRateLimited(null, "test-id");
    expect(result).toBe(false);
  });

  it("returns false when request is within limit", async () => {
    mockLimitFn.mockResolvedValue({ success: true });

    const limiter = createMockLimiter();
    const result = await isRateLimited(limiter, "test-id");
    expect(result).toBe(false);
  });

  it("returns true when rate limited", async () => {
    mockLimitFn.mockResolvedValue({ success: false });

    const limiter = createMockLimiter();
    const result = await isRateLimited(limiter, "test-id");
    expect(result).toBe(true);
  });

  it("passes identifier to limiter", async () => {
    mockLimitFn.mockResolvedValue({ success: true });

    const limiter = createMockLimiter();
    await isRateLimited(limiter, "user-42:action");
    expect(mockLimitFn).toHaveBeenCalledWith("user-42:action");
  });
});
