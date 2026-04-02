import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function makeRequest(url: string, host: string) {
  const req = new NextRequest(new URL(url, "http://localhost"), {
    headers: { host },
  });
  return req;
}

describe("middleware", () => {
  it("rewrites links subdomain requests to /links/[username]", () => {
    const req = makeRequest("/someuser", "links.vibrantsocial.app");
    const res = middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/links/someuser");
  });

  it("rewrites links.localhost requests for local dev", () => {
    const req = makeRequest("/testuser", "links.localhost:3000");
    const res = middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/links/testuser");
  });

  it("does not rewrite non-links subdomain requests", () => {
    const req = makeRequest("/someuser", "vibrantsocial.app");
    const res = middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("does not rewrite _next paths on links subdomain", () => {
    const req = makeRequest("/_next/static/chunk.js", "links.vibrantsocial.app");
    const res = middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("does not rewrite /api paths on links subdomain", () => {
    const req = makeRequest("/api/auth/session", "links.vibrantsocial.app");
    const res = middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("rewrites root path on links subdomain", () => {
    const req = makeRequest("/", "links.vibrantsocial.app");
    const res = middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/links");
  });
});
