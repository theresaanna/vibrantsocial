import { describe, it, expect, vi, beforeEach } from "vitest";
import { togglePinPost } from "@/app/feed/actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    repost: {
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
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

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: {
    tagCloud: () => "tagCloud",
    nsfwTagCloud: () => "nsfwTagCloud",
    tagPostCount: (name: string) => `tagPostCount:${name}`,
  },
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

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };

describe("togglePinPost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await togglePinPost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if post not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce(null as never);
    const result = await togglePinPost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authorized");
  });

  it("returns error if user is not the post author", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      id: "p1",
      authorId: "other-user",
      isPinned: false,
    } as never);
    const result = await togglePinPost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authorized");
  });

  it("pins a post and unpins any previously pinned post", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      id: "p1",
      authorId: "user1",
      isPinned: false,
    } as never);
    mockPrisma.post.updateMany.mockResolvedValueOnce({ count: 1 } as never);
    mockPrisma.repost.updateMany.mockResolvedValueOnce({ count: 0 } as never);
    mockPrisma.post.update.mockResolvedValueOnce({} as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ username: "testuser" } as never);

    const result = await togglePinPost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Post pinned");
    expect(mockPrisma.post.updateMany).toHaveBeenCalledWith({
      where: { authorId: "user1", isPinned: true },
      data: { isPinned: false },
    });
    expect(mockPrisma.post.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { isPinned: true },
    });
  });

  it("unpins a currently pinned post", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      id: "p1",
      authorId: "user1",
      isPinned: true,
    } as never);
    mockPrisma.post.update.mockResolvedValueOnce({} as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ username: "testuser" } as never);

    const result = await togglePinPost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Post unpinned");
    expect(mockPrisma.post.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { isPinned: false },
    });
    expect(mockPrisma.post.updateMany).not.toHaveBeenCalled();
  });

  it("returns error if postId is missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await togglePinPost(prevState, new FormData());
    expect(result.success).toBe(false);
    expect(result.message).toBe("Post ID required");
  });
});
