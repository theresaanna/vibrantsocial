import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockLinkUsersInGroup = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/account-linking-db", () => ({
  linkUsersInGroup: (...args: unknown[]) => mockLinkUsersInGroup(...args),
}));

const { GET } = await import("@/app/api/finish-link/route");

function makeRequest(
  path: string,
  cookies: Record<string, string> = {}
): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("; ");
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe("/api/finish-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "oauth-user-id" } });
  });

  it("redirects to /profile when from param matches cookie", async () => {
    const req = makeRequest("/api/finish-link?from=original-user", {
      linkFromUserId: "original-user",
    });
    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/profile");
  });

  it("links accounts when from (original) differs from session user (OAuth)", async () => {
    const req = makeRequest("/api/finish-link?from=original-user", {
      linkFromUserId: "original-user",
    });
    await GET(req);

    expect(mockLinkUsersInGroup).toHaveBeenCalledWith(
      "original-user",
      "oauth-user-id"
    );
  });

  it("sets _switchTo param when accounts differ", async () => {
    const req = makeRequest("/api/finish-link?from=original-user", {
      linkFromUserId: "original-user",
    });
    const response = await GET(req);

    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("_switchTo")).toBe("original-user");
  });

  it("does NOT set _switchTo when from matches session user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "same-user" } });
    const req = makeRequest("/api/finish-link?from=same-user", {
      linkFromUserId: "same-user",
    });
    const response = await GET(req);

    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("_switchTo")).toBeNull();
  });

  it("redirects to /profile without linking when from param is missing", async () => {
    const req = makeRequest("/api/finish-link", {
      linkFromUserId: "original-user",
    });
    const response = await GET(req);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe(
      "/profile"
    );
    expect(mockLinkUsersInGroup).not.toHaveBeenCalled();
  });

  it("redirects to /profile when from param doesn't match cookie", async () => {
    const req = makeRequest("/api/finish-link?from=attacker-id", {
      linkFromUserId: "original-user",
    });
    const response = await GET(req);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe(
      "/profile"
    );
    expect(mockLinkUsersInGroup).not.toHaveBeenCalled();
  });

  it("redirects to /login when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = makeRequest("/api/finish-link?from=original-user", {
      linkFromUserId: "original-user",
    });
    const response = await GET(req);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("cleans up cookies after processing", async () => {
    const req = makeRequest("/api/finish-link?from=original-user", {
      linkFromUserId: "original-user",
    });
    const response = await GET(req);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("linkFromUserId");
    expect(setCookie).toContain("linkRedirect");
  });
});
