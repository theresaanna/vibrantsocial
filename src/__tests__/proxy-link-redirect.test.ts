import { describe, it, expect, vi, beforeEach } from "vitest";

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

  it("redirects to finish-link when linkRedirect is set", async () => {
    const req = makeRequest("/", {
      linkRedirect: "/api/auth/finish-link?from=user1",
    });
    const response = await proxy(req);

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/api/auth/finish-link");
    expect(location.searchParams.get("from")).toBe("user1");
  });

  it("redirects even when linkFromUserId is still present", async () => {
    // linkFromUserId may not have been cleaned up by the JWT callback,
    // but the proxy should still redirect to finish-link
    const req = makeRequest("/feed", {
      linkRedirect: "/api/auth/finish-link?from=user1",
      linkFromUserId: "user1",
    });
    const response = await proxy(req);

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/api/auth/finish-link");
  });

  it("deletes linkRedirect cookie on redirect", async () => {
    const req = makeRequest("/feed", {
      linkRedirect: "/api/auth/finish-link?from=user1",
    });
    const response = await proxy(req);

    expect(response.status).toBe(307);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("linkRedirect");
  });

  it("does not redirect when no linkRedirect cookie", async () => {
    const req = makeRequest("/feed");
    const response = await proxy(req);

    // Should pass through (not a redirect to finish-link)
    expect(response.status).not.toBe(307);
  });
});
