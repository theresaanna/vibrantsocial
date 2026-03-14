import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user1" } }),
}));

const { proxy } = await import("@/proxy");

function makeRequest(
  path: string,
  cookies: Record<string, string> = {}
): Request {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("; ");
  return new Request(`http://localhost:3000${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe("proxy – linkRedirect cookie handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to target when linkRedirect is set and linkFromUserId is absent", async () => {
    const req = makeRequest("/", { linkRedirect: "/profile" });
    const response = await proxy(req);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe(
      "/profile"
    );
  });

  it("does NOT consume linkRedirect when linkFromUserId is still present", async () => {
    const req = makeRequest("/profile", {
      linkRedirect: "/profile",
      linkFromUserId: "user1",
    });
    const response = await proxy(req);

    // Should pass through without redirect (linkFromUserId still present
    // means we haven't completed the OAuth flow yet)
    expect(response.status).not.toBe(307);
  });

  it("cleans up linkRedirect when already at the target path", async () => {
    const req = makeRequest("/profile", { linkRedirect: "/profile" });
    const response = await proxy(req);

    // Should not redirect (already at target)
    expect(response.status).not.toBe(307);
    // Should delete the cookie
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("linkRedirect");
  });

  it("redirects from /feed to /profile via linkRedirect after OAuth", async () => {
    // Simulates: OAuth callback redirected to / → /feed, but linkRedirect
    // should send the user to /profile instead
    const req = makeRequest("/feed", { linkRedirect: "/profile" });
    const response = await proxy(req);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe(
      "/profile"
    );
  });
});
