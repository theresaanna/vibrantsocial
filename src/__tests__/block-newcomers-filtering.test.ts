import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

const mockFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
}));

const mockGetAllBlockRelatedIds = vi.fn();
vi.mock("@/app/feed/block-actions", () => ({
  getAllBlockRelatedIds: (...args: unknown[]) => mockGetAllBlockRelatedIds(...args),
}));

describe("fetchNewcomers block filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns all newcomers when user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([
      { id: "u1", username: "alice" },
      { id: "u2", username: "bob" },
    ]);

    const { fetchNewcomers } = await import("@/app/communities/newcomer-actions");
    const result = await fetchNewcomers();

    expect(result).toHaveLength(2);
    expect(mockGetAllBlockRelatedIds).not.toHaveBeenCalled();
  });

  it("does not apply block filter when user has no blocks", async () => {
    mockAuth.mockResolvedValue({ user: { id: "me" } });
    mockGetAllBlockRelatedIds.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([
      { id: "u1", username: "alice" },
    ]);

    const { fetchNewcomers } = await import("@/app/communities/newcomer-actions");
    await fetchNewcomers();

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.id).toBeUndefined();
  });

  it("excludes blocked users from newcomers list", async () => {
    mockAuth.mockResolvedValue({ user: { id: "me" } });
    mockGetAllBlockRelatedIds.mockResolvedValue(["blocked1", "blocked2"]);
    mockFindMany.mockResolvedValue([
      { id: "u1", username: "alice" },
    ]);

    const { fetchNewcomers } = await import("@/app/communities/newcomer-actions");
    await fetchNewcomers();

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.id).toEqual({ notIn: ["blocked1", "blocked2"] });
  });

  it("calls getAllBlockRelatedIds with the current user id", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockGetAllBlockRelatedIds.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const { fetchNewcomers } = await import("@/app/communities/newcomer-actions");
    await fetchNewcomers();

    expect(mockGetAllBlockRelatedIds).toHaveBeenCalledWith("user-123");
  });

  it("excludes users blocked in both directions", async () => {
    mockAuth.mockResolvedValue({ user: { id: "me" } });
    // user-a blocked by me, user-b blocked me
    mockGetAllBlockRelatedIds.mockResolvedValue(["user-a", "user-b"]);
    mockFindMany.mockResolvedValue([]);

    const { fetchNewcomers } = await import("@/app/communities/newcomer-actions");
    await fetchNewcomers();

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.id.notIn).toContain("user-a");
    expect(query.where.id.notIn).toContain("user-b");
  });

  it("still filters by username not null", async () => {
    mockAuth.mockResolvedValue({ user: { id: "me" } });
    mockGetAllBlockRelatedIds.mockResolvedValue(["blocked1"]);
    mockFindMany.mockResolvedValue([]);

    const { fetchNewcomers } = await import("@/app/communities/newcomer-actions");
    await fetchNewcomers();

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.username).toEqual({ not: null });
  });

  it("returns JSON-serialized result", async () => {
    mockAuth.mockResolvedValue(null);
    const date = new Date("2026-01-01");
    mockFindMany.mockResolvedValue([
      { id: "u1", username: "alice", createdAt: date },
    ]);

    const { fetchNewcomers } = await import("@/app/communities/newcomer-actions");
    const result = await fetchNewcomers();

    // Date should be serialized to string
    expect(typeof result[0].createdAt).toBe("string");
  });
});
