import { describe, it, expect, vi } from "vitest";
import { proxy } from "@/proxy";

// Mock auth
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

function makeRequest(url: string, host: string) {
  return new Request(new URL(url, "http://localhost"), {
    headers: { host },
  });
}

describe("proxy – links subdomain routing", () => {
  it("rewrites links subdomain requests to /links/[username]", async () => {
    const req = makeRequest("/someuser", "links.vibrantsocial.app");
    const res = await proxy(req);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/links/someuser");
  });

  it("rewrites links.localhost requests for local dev", async () => {
    const req = makeRequest("/testuser", "links.localhost:3000");
    const res = await proxy(req);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/links/testuser");
  });

  it("does not rewrite non-links subdomain requests", async () => {
    const req = makeRequest("/someuser", "vibrantsocial.app");
    const res = await proxy(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("does not rewrite _next paths on links subdomain", async () => {
    const req = makeRequest("/_next/static/chunk.js", "links.vibrantsocial.app");
    const res = await proxy(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("does not rewrite /api paths on links subdomain", async () => {
    const req = makeRequest("/api/auth/session", "links.vibrantsocial.app");
    const res = await proxy(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("rewrites root path on links subdomain", async () => {
    const req = makeRequest("/", "links.vibrantsocial.app");
    const res = await proxy(req);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/links");
  });
});
