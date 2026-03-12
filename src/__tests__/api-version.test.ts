import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID;

beforeEach(() => {
  process.env.NEXT_PUBLIC_BUILD_ID = "test-build-id";
  vi.resetModules();
});

afterEach(() => {
  process.env.NEXT_PUBLIC_BUILD_ID = ORIGINAL_BUILD_ID;
});

describe("GET /api/version", () => {
  it("returns the build ID as JSON", async () => {
    const { GET } = await import("@/app/api/version/route");
    const res = GET();
    const json = await res.json();

    expect(json).toEqual({ buildId: "test-build-id" });
  });

  it("sets no-cache headers", async () => {
    const { GET } = await import("@/app/api/version/route");
    const res = GET();

    expect(res.headers.get("Cache-Control")).toBe(
      "no-cache, no-store, must-revalidate"
    );
  });

  it("returns 200 status", async () => {
    const { GET } = await import("@/app/api/version/route");
    const res = GET();

    expect(res.status).toBe(200);
  });
});
