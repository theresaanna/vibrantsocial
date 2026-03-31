import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockGroupBy = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    pollVote: {
      create: (...args: unknown[]) => mockCreate(...args),
      findUnique: vi.fn(),
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
    },
  },
}));

const mockPublish = vi.fn();
vi.mock("@/lib/ably", () => ({
  getAblyRestClient: () => ({
    channels: {
      get: () => ({ publish: mockPublish }),
    },
  }),
}));

describe("votePoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { votePoll } = await import("@/app/feed/poll-actions");
    await expect(votePoll("post-1", "opt-1")).rejects.toThrow("Not authenticated");
  });

  it("throws when post does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockFindUnique.mockResolvedValue(null);
    const { votePoll } = await import("@/app/feed/poll-actions");
    await expect(votePoll("post-missing", "opt-1")).rejects.toThrow("Post not found");
  });

  it("creates a vote and returns aggregated counts", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockFindUnique.mockResolvedValue({ id: "post-1" });
    mockCreate.mockResolvedValue({ id: "vote-1" });
    mockGroupBy.mockResolvedValue([
      { optionId: "opt-1", _count: { id: 3 } },
      { optionId: "opt-2", _count: { id: 1 } },
    ]);

    const { votePoll } = await import("@/app/feed/poll-actions");
    const result = await votePoll("post-1", "opt-1");

    expect(mockCreate).toHaveBeenCalledWith({
      data: { postId: "post-1", optionId: "opt-1", userId: "u1" },
    });
    expect(result.votes).toEqual({ "opt-1": 3, "opt-2": 1 });
    expect(result.userVote).toBe("opt-1");
  });

  it("publishes a real-time update via Ably", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockFindUnique.mockResolvedValue({ id: "post-1" });
    mockCreate.mockResolvedValue({ id: "vote-1" });
    mockGroupBy.mockResolvedValue([
      { optionId: "opt-1", _count: { id: 1 } },
    ]);

    const { votePoll } = await import("@/app/feed/poll-actions");
    await votePoll("post-1", "opt-1");

    expect(mockPublish).toHaveBeenCalledWith("vote", {
      votes: { "opt-1": 1 },
      voterId: "u1",
    });
  });

  it("rejects double voting via unique constraint", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockFindUnique.mockResolvedValue({ id: "post-1" });
    mockCreate.mockRejectedValue(new Error("Unique constraint failed"));

    const { votePoll } = await import("@/app/feed/poll-actions");
    await expect(votePoll("post-1", "opt-1")).rejects.toThrow("Unique constraint failed");
  });
});

describe("getPollVotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns empty votes and null userVote for unauthenticated users", async () => {
    mockAuth.mockResolvedValue(null);
    mockGroupBy.mockResolvedValue([]);

    const { getPollVotes } = await import("@/app/feed/poll-actions");
    const result = await getPollVotes("post-1");

    expect(result.votes).toEqual({});
    expect(result.userVote).toBeNull();
  });

  it("returns aggregated vote counts", async () => {
    mockAuth.mockResolvedValue(null);
    mockGroupBy.mockResolvedValue([
      { optionId: "opt-1", _count: { id: 5 } },
      { optionId: "opt-2", _count: { id: 2 } },
    ]);

    const { getPollVotes } = await import("@/app/feed/poll-actions");
    const result = await getPollVotes("post-1");

    expect(result.votes).toEqual({ "opt-1": 5, "opt-2": 2 });
  });

  it("returns the user's vote when authenticated", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockGroupBy.mockResolvedValue([
      { optionId: "opt-2", _count: { id: 3 } },
    ]);

    // Mock findUnique on pollVote to return existing vote
    const { prisma } = await import("@/lib/prisma");
    (prisma.pollVote.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      optionId: "opt-2",
    });

    const { getPollVotes } = await import("@/app/feed/poll-actions");
    const result = await getPollVotes("post-1");

    expect(result.userVote).toBe("opt-2");
  });

  it("returns null userVote when authenticated user has not voted", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockGroupBy.mockResolvedValue([]);

    const { prisma } = await import("@/lib/prisma");
    (prisma.pollVote.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { getPollVotes } = await import("@/app/feed/poll-actions");
    const result = await getPollVotes("post-1");

    expect(result.userVote).toBeNull();
  });
});
