import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    follow: {
      findMany: vi.fn(),
    },
    repost: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    closeFriend: {
      findMany: vi.fn(),
    },
    postTag: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    postRevision: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
    },
    tag: {
      upsert: vi.fn().mockResolvedValue({ id: "tag1", name: "test" }),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(),
  cacheKeys: {
    userFollowing: (id: string) => `user:${id}:following`,
    tagCloud: () => "tagCloud",
    nsfwTagCloud: () => "nsfwTagCloud",
    tagPostCount: (name: string) => `tagPostCount:${name}`,
  },
}));

vi.mock("@/lib/phone-gate", () => ({
  requirePhoneVerification: vi.fn(),
}));

vi.mock("@/lib/age-gate", () => ({
  requireMinimumAge: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/mentions", () => ({
  extractMentionsFromLexicalJson: vi.fn().mockReturnValue([]),
  createMentionNotifications: vi.fn(),
}));

vi.mock("@/lib/tags", () => ({
  extractTagsFromNames: vi.fn((names: string[]) => names),
}));

vi.mock("@/lib/subscription-notifications", () => ({
  notifyPostSubscribers: vi.fn(),
}));

vi.mock("@/lib/tag-subscription-notifications", () => ({
  notifyTagSubscribers: vi.fn(),
}));

vi.mock("@/lib/referral", () => ({
  awardReferralFirstPostBonus: vi.fn(),
  checkStarsMilestone: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fetchSinglePost } from "@/app/feed/feed-actions";
import { togglePinPost } from "@/app/feed/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockRevalidate = vi.mocked(revalidatePath);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };

/* ── fetchSinglePost ─────────────────────────────────── */

describe("fetchSinglePost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await fetchSinglePost("p1");
    expect(result).toBeNull();
  });

  it("returns null when post not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce(null as never);

    const result = await fetchSinglePost("nonexistent");
    expect(result).toBeNull();
  });

  it("returns post data with type and date", async () => {
    const date = new Date("2024-06-15T10:00:00.000Z");
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      id: "p1",
      content: "test",
      createdAt: date,
      authorId: "user1",
    } as never);

    const result = await fetchSinglePost("p1");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("post");
    expect(result!.date).toBe(date.toISOString());
    expect(result!.data.id).toBe("p1");
  });
});

/* ── togglePinPost ─────────────────────────────────── */

describe("togglePinPost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await togglePinPost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if postId is missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await togglePinPost(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Post ID required");
  });

  it("returns error if post not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce(null as never);

    const result = await togglePinPost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authorized");
  });

  it("returns error if user is not the author", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique
      .mockResolvedValueOnce({ id: "p1", authorId: "other", isPinned: false } as never);

    const result = await togglePinPost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authorized");
  });

  it("unpins a currently pinned post", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // First call: post lookup
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      id: "p1",
      authorId: "user1",
      isPinned: true,
    } as never);
    mockPrisma.post.update.mockResolvedValueOnce({} as never);
    // Second call: user.findUnique for username lookup
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await togglePinPost(
      prevState,
      makeFormData({ postId: "p1" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Post unpinned");
    expect(mockPrisma.post.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { isPinned: false },
    });
  });

  it("pins a post and unpins any existing pinned content", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // First call: post lookup
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      id: "p1",
      authorId: "user1",
      isPinned: false,
    } as never);
    mockPrisma.post.updateMany.mockResolvedValueOnce({ count: 0 } as never);
    mockPrisma.repost.updateMany.mockResolvedValueOnce({ count: 0 } as never);
    mockPrisma.post.update.mockResolvedValueOnce({} as never);
    // Second call: user.findUnique for username lookup
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "alice",
    } as never);

    const result = await togglePinPost(
      prevState,
      makeFormData({ postId: "p1" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Post pinned");
    // Should unpin existing pinned posts
    expect(mockPrisma.post.updateMany).toHaveBeenCalledWith({
      where: { authorId: "user1", isPinned: true },
      data: { isPinned: false },
    });
    // Should unpin existing pinned reposts
    expect(mockPrisma.repost.updateMany).toHaveBeenCalledWith({
      where: { userId: "user1", isPinned: true },
      data: { isPinned: false },
    });
    // Should pin the requested post
    expect(mockPrisma.post.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { isPinned: true },
    });
    // Should revalidate user profile path
    expect(mockRevalidate).toHaveBeenCalledWith("/alice");
  });
});
