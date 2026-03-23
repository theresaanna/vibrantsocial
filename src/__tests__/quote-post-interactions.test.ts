import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    repostLike: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    repostBookmark: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    repostComment: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    repost: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/phone-gate", () => ({
  requirePhoneVerification: vi.fn(),
}));

vi.mock("@/lib/mentions", () => ({
  extractMentionsFromPlainText: vi.fn().mockReturnValue([]),
  createMentionNotifications: vi.fn(),
}));

vi.mock("@/lib/ably", () => ({
  getAblyRestClient: vi.fn().mockReturnValue({
    channels: { get: vi.fn().mockReturnValue({ publish: vi.fn() }) },
  }),
}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock("@/lib/referral", () => ({
  awardReferralFirstPostBonus: vi.fn(),
  checkStarsMilestone: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { requirePhoneVerification } from "@/lib/phone-gate";
import {
  toggleRepostLike,
  toggleRepostBookmark,
  createRepostComment,
} from "@/app/feed/post-actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockCreateNotification = vi.mocked(createNotification);
const mockRequirePhone = vi.mocked(requirePhoneVerification);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const initial = { success: false, message: "" };

describe("toggleRepostLike", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", username: "alice" },
      expires: "",
    });
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const fd = makeFormData({ repostId: "r1" });
    const result = await toggleRepostLike(initial, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("creates a like when none exists", async () => {
    mockPrisma.repostLike.findUnique.mockResolvedValue(null);
    mockPrisma.repostLike.create.mockResolvedValue({
      id: "rl1",
      repostId: "r1",
      userId: "u1",
      createdAt: new Date(),
    });
    mockPrisma.repost.findUnique.mockResolvedValue({
      id: "r1",
      userId: "u2",
    } as never);

    const fd = makeFormData({ repostId: "r1" });
    const result = await toggleRepostLike(initial, fd);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Liked");
    expect(mockPrisma.repostLike.create).toHaveBeenCalledWith({
      data: { repostId: "r1", userId: "u1" },
    });
  });

  it("creates LIKE notification for repost author", async () => {
    mockPrisma.repostLike.findUnique.mockResolvedValue(null);
    mockPrisma.repostLike.create.mockResolvedValue({
      id: "rl1",
      repostId: "r1",
      userId: "u1",
      createdAt: new Date(),
    });
    mockPrisma.repost.findUnique.mockResolvedValue({
      id: "r1",
      userId: "u2",
    } as never);

    const fd = makeFormData({ repostId: "r1" });
    await toggleRepostLike(initial, fd);

    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "LIKE",
      actorId: "u1",
      targetUserId: "u2",
      repostId: "r1",
    });
  });

  it("removes like when one exists", async () => {
    mockPrisma.repostLike.findUnique.mockResolvedValue({
      id: "rl1",
      repostId: "r1",
      userId: "u1",
      createdAt: new Date(),
    });

    const fd = makeFormData({ repostId: "r1" });
    const result = await toggleRepostLike(initial, fd);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Unliked");
    expect(mockPrisma.repostLike.delete).toHaveBeenCalledWith({
      where: { id: "rl1" },
    });
  });

  it("does not notify when unliking", async () => {
    mockPrisma.repostLike.findUnique.mockResolvedValue({
      id: "rl1",
      repostId: "r1",
      userId: "u1",
      createdAt: new Date(),
    });

    const fd = makeFormData({ repostId: "r1" });
    await toggleRepostLike(initial, fd);

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("revalidates correct paths", async () => {
    mockPrisma.repostLike.findUnique.mockResolvedValue(null);
    mockPrisma.repostLike.create.mockResolvedValue({
      id: "rl1",
      repostId: "r1",
      userId: "u1",
      createdAt: new Date(),
    });
    mockPrisma.repost.findUnique.mockResolvedValue({
      id: "r1",
      userId: "u2",
    } as never);

    const fd = makeFormData({ repostId: "r1" });
    await toggleRepostLike(initial, fd);

    expect(mockRevalidatePath).toHaveBeenCalledWith("/feed");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/quote/r1");
  });
});

describe("toggleRepostBookmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", username: "alice" },
      expires: "",
    });
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const fd = makeFormData({ repostId: "r1" });
    const result = await toggleRepostBookmark(initial, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("creates bookmark when none exists", async () => {
    mockPrisma.repostBookmark.findUnique.mockResolvedValue(null);
    mockPrisma.repostBookmark.create.mockResolvedValue({
      id: "rb1",
      repostId: "r1",
      userId: "u1",
      createdAt: new Date(),
    });
    mockPrisma.repost.findUnique.mockResolvedValue({
      id: "r1",
      userId: "u2",
    } as never);

    const fd = makeFormData({ repostId: "r1" });
    const result = await toggleRepostBookmark(initial, fd);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Bookmarked");
  });

  it("creates BOOKMARK notification for repost author", async () => {
    mockPrisma.repostBookmark.findUnique.mockResolvedValue(null);
    mockPrisma.repostBookmark.create.mockResolvedValue({
      id: "rb1",
      repostId: "r1",
      userId: "u1",
      createdAt: new Date(),
    });
    mockPrisma.repost.findUnique.mockResolvedValue({
      id: "r1",
      userId: "u2",
    } as never);

    const fd = makeFormData({ repostId: "r1" });
    await toggleRepostBookmark(initial, fd);

    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "BOOKMARK",
      actorId: "u1",
      targetUserId: "u2",
      repostId: "r1",
    });
  });

  it("removes bookmark when one exists", async () => {
    mockPrisma.repostBookmark.findUnique.mockResolvedValue({
      id: "rb1",
      repostId: "r1",
      userId: "u1",
      createdAt: new Date(),
    });

    const fd = makeFormData({ repostId: "r1" });
    const result = await toggleRepostBookmark(initial, fd);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Unbookmarked");
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("revalidates bookmarks path", async () => {
    mockPrisma.repostBookmark.findUnique.mockResolvedValue(null);
    mockPrisma.repostBookmark.create.mockResolvedValue({
      id: "rb1",
      repostId: "r1",
      userId: "u1",
      createdAt: new Date(),
    });
    mockPrisma.repost.findUnique.mockResolvedValue({
      id: "r1",
      userId: "u2",
    } as never);

    const fd = makeFormData({ repostId: "r1" });
    await toggleRepostBookmark(initial, fd);

    expect(mockRevalidatePath).toHaveBeenCalledWith("/bookmarks");
  });
});

describe("createRepostComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", username: "alice" },
      expires: "",
    });
    mockRequirePhone.mockResolvedValue(true);
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const fd = makeFormData({ repostId: "r1", content: "nice quote" });
    const result = await createRepostComment(initial, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if phone not verified", async () => {
    mockRequirePhone.mockResolvedValue(false);
    const fd = makeFormData({ repostId: "r1", content: "nice quote" });
    const result = await createRepostComment(initial, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Phone verification required to comment");
  });

  it("returns error if content is empty", async () => {
    const fd = makeFormData({ repostId: "r1", content: "" });
    const result = await createRepostComment(initial, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Comment cannot be empty");
  });

  it("returns error if content is whitespace only", async () => {
    const fd = makeFormData({ repostId: "r1", content: "   " });
    const result = await createRepostComment(initial, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Comment cannot be empty");
  });

  it("returns error if content exceeds 1000 chars", async () => {
    const fd = makeFormData({ repostId: "r1", content: "a".repeat(1001) });
    const result = await createRepostComment(initial, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Comment too long (max 1000 characters)");
  });

  it("creates comment on success", async () => {
    mockPrisma.repostComment.create.mockResolvedValue({
      id: "rc1",
      content: "nice quote",
      repostId: "r1",
      authorId: "u1",
      parentId: null,
      createdAt: new Date(),
      author: { id: "u1", username: "alice", displayName: "Alice", name: null, image: null, avatar: null },
    });
    mockPrisma.repost.findUnique.mockResolvedValue({
      id: "r1",
      userId: "u2",
    } as never);
    mockPrisma.repostComment.count.mockResolvedValue(1);

    const fd = makeFormData({ repostId: "r1", content: "nice quote" });
    const result = await createRepostComment(initial, fd);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Comment added");
  });

  it("creates COMMENT notification for repost author", async () => {
    mockPrisma.repostComment.create.mockResolvedValue({
      id: "rc1",
      content: "nice",
      repostId: "r1",
      authorId: "u1",
      parentId: null,
      createdAt: new Date(),
      author: { id: "u1", username: "alice", displayName: "Alice", name: null, image: null, avatar: null },
    });
    mockPrisma.repost.findUnique.mockResolvedValue({
      id: "r1",
      userId: "u2",
    } as never);
    mockPrisma.repostComment.count.mockResolvedValue(1);

    const fd = makeFormData({ repostId: "r1", content: "nice" });
    await createRepostComment(initial, fd);

    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "COMMENT",
      actorId: "u1",
      targetUserId: "u2",
      repostId: "r1",
    });
  });

  it("does not notify when commenting on own quote", async () => {
    mockPrisma.repostComment.create.mockResolvedValue({
      id: "rc1",
      content: "self comment",
      repostId: "r1",
      authorId: "u1",
      parentId: null,
      createdAt: new Date(),
      author: { id: "u1", username: "alice", displayName: "Alice", name: null, image: null, avatar: null },
    });
    mockPrisma.repost.findUnique.mockResolvedValue({
      id: "r1",
      userId: "u1", // same user
    } as never);
    mockPrisma.repostComment.count.mockResolvedValue(1);

    const fd = makeFormData({ repostId: "r1", content: "self comment" });
    await createRepostComment(initial, fd);

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("revalidates correct paths", async () => {
    mockPrisma.repostComment.create.mockResolvedValue({
      id: "rc1",
      content: "test",
      repostId: "r1",
      authorId: "u1",
      parentId: null,
      createdAt: new Date(),
      author: { id: "u1", username: "alice", displayName: "Alice", name: null, image: null, avatar: null },
    });
    mockPrisma.repost.findUnique.mockResolvedValue({
      id: "r1",
      userId: "u2",
    } as never);
    mockPrisma.repostComment.count.mockResolvedValue(1);

    const fd = makeFormData({ repostId: "r1", content: "test" });
    await createRepostComment(initial, fd);

    expect(mockRevalidatePath).toHaveBeenCalledWith("/feed");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/quote/r1");
  });
});
