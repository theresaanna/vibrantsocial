import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/anthropic", () => ({
  anthropic: {
    messages: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    follow: { findMany: vi.fn() },
    closeFriend: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    post: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  cacheKeys: {
    userFollowing: (id: string) => `user:${id}:following`,
  },
}));

vi.mock("@/app/feed/block-actions", () => ({
  getAllBlockRelatedIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/lexical-text", () => ({
  extractTextFromLexicalJson: vi.fn((content: string) => content),
}));

import { auth } from "@/auth";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import {
  fetchFeedSummary,
  generateFeedSummaryOnDemand,
} from "@/app/feed/summary-actions";

const mockAuth = vi.mocked(auth);
const mockAnthropicCreate = vi.mocked(anthropic.messages.create);
const mockFollowFindMany = vi.mocked(prisma.follow.findMany);
const mockCloseFriendFindMany = vi.mocked(prisma.closeFriend.findMany);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockPostFindMany = vi.mocked(prisma.post.findMany);

function setupAuthenticatedUser() {
  mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
  mockFollowFindMany.mockResolvedValue([
    { followingId: "friend1" },
  ] as never);
  mockCloseFriendFindMany.mockResolvedValue([] as never);
  mockUserFindUnique.mockResolvedValue({
    showNsfwContent: false,
    ageVerified: null,
  } as never);
}

function makeMockPost(overrides: Record<string, unknown> = {}) {
  return {
    content: "Hello world",
    author: { displayName: "Alice", username: "alice" },
    _count: { likes: 5, comments: 2, reposts: 1 },
    createdAt: new Date("2026-03-23T12:00:00Z"),
    ...overrides,
  };
}

describe("fetchFeedSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result if not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const result = await fetchFeedSummary("2026-03-23T00:00:00Z");
    expect(result).toEqual({ summary: null, missedCount: 0, tooMany: false });
    expect(mockPostFindMany).not.toHaveBeenCalled();
  });

  it("returns empty result if gap is less than 1 hour", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);

    const thirtyMinutesAgo = new Date(
      Date.now() - 30 * 60 * 1000
    ).toISOString();

    const result = await fetchFeedSummary(thirtyMinutesAgo);
    expect(result).toEqual({ summary: null, missedCount: 0, tooMany: false });
    expect(mockPostFindMany).not.toHaveBeenCalled();
  });

  it("returns empty result if no posts found", async () => {
    setupAuthenticatedUser();
    mockPostFindMany.mockResolvedValue([] as never);

    const twoHoursAgo = new Date(
      Date.now() - 2 * 60 * 60 * 1000
    ).toISOString();

    const result = await fetchFeedSummary(twoHoursAgo);
    expect(result).toEqual({ summary: null, missedCount: 0, tooMany: false });
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it("returns tooMany when more than 50 posts", async () => {
    setupAuthenticatedUser();
    const posts = Array.from({ length: 51 }, () => makeMockPost());
    mockPostFindMany.mockResolvedValue(posts as never);

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const result = await fetchFeedSummary(dayAgo);
    expect(result.tooMany).toBe(true);
    expect(result.missedCount).toBe(51);
    expect(result.summary).toBeNull();
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it("generates summary for posts within limit", async () => {
    setupAuthenticatedUser();
    mockPostFindMany.mockResolvedValue([
      makeMockPost(),
      makeMockPost({ content: "Another post", author: { displayName: "Bob", username: "bob" } }),
    ] as never);
    mockAnthropicCreate.mockResolvedValue({
      content: [
        { type: "text", text: "Alice and Bob were chatting! Alice's post got 5 likes." },
      ],
    } as never);

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const result = await fetchFeedSummary(dayAgo);
    expect(result.summary).toBe(
      "Alice and Bob were chatting! Alice's post got 5 likes."
    );
    expect(result.missedCount).toBe(2);
    expect(result.tooMany).toBe(false);

    const call = mockAnthropicCreate.mock.calls[0][0];
    expect(call.model).toBe("claude-haiku-4-5");
    expect(call.max_tokens).toBe(200);
  });

  it("returns fallback when Claude returns no text block", async () => {
    setupAuthenticatedUser();
    mockPostFindMany.mockResolvedValue([makeMockPost()] as never);
    mockAnthropicCreate.mockResolvedValue({ content: [] } as never);

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const result = await fetchFeedSummary(dayAgo);
    expect(result.summary).toBe("You have 1 new posts in your feed!");
  });

  it("handles API error gracefully", async () => {
    setupAuthenticatedUser();
    mockPostFindMany.mockResolvedValue([makeMockPost()] as never);
    mockAnthropicCreate.mockRejectedValue(new Error("API error"));

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const result = await fetchFeedSummary(dayAgo);
    expect(result).toEqual({ summary: null, missedCount: 0, tooMany: false });
  });
});

describe("generateFeedSummaryOnDemand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null if not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const result = await generateFeedSummaryOnDemand("2026-03-23T00:00:00Z");
    expect(result).toBeNull();
  });

  it("returns null if no posts", async () => {
    setupAuthenticatedUser();
    mockPostFindMany.mockResolvedValue([] as never);

    const result = await generateFeedSummaryOnDemand("2026-03-23T00:00:00Z");
    expect(result).toBeNull();
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it("generates summary regardless of post count", async () => {
    setupAuthenticatedUser();
    mockPostFindMany.mockResolvedValue([
      makeMockPost(),
      makeMockPost(),
      makeMockPost(),
    ] as never);
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Lots of activity today!" }],
    } as never);

    const result = await generateFeedSummaryOnDemand("2026-03-22T00:00:00Z");
    expect(result).toBe("Lots of activity today!");
  });

  it("handles API error gracefully", async () => {
    setupAuthenticatedUser();
    mockPostFindMany.mockResolvedValue([makeMockPost()] as never);
    mockAnthropicCreate.mockRejectedValue(new Error("API error"));

    const result = await generateFeedSummaryOnDemand("2026-03-23T00:00:00Z");
    expect(result).toBeNull();
  });
});
