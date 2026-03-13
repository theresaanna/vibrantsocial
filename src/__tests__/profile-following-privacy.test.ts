import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/app/feed/follow-actions", () => ({
  getFollowing: vi.fn().mockResolvedValue([]),
}));

const mockRedirect = vi.fn();
const mockNotFound = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error("REDIRECT");
  },
  notFound: () => {
    mockNotFound();
    throw new Error("NOT_FOUND");
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

describe("Following page privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("redirects unauthenticated users to login", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const { default: FollowingPage } = await import(
      "@/app/[username]/following/page"
    );

    await expect(
      FollowingPage({ params: Promise.resolve({ username: "testuser" }) })
    ).rejects.toThrow("REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects non-owner to the profile page", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "other-user" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "profile-owner",
    } as never);

    const { default: FollowingPage } = await import(
      "@/app/[username]/following/page"
    );

    await expect(
      FollowingPage({ params: Promise.resolve({ username: "testuser" }) })
    ).rejects.toThrow("REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/testuser");
  });

  it("returns 404 for non-existent user", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "some-user" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const { default: FollowingPage } = await import(
      "@/app/[username]/following/page"
    );

    await expect(
      FollowingPage({ params: Promise.resolve({ username: "nonexistent" }) })
    ).rejects.toThrow("NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });
});
