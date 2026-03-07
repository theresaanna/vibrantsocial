import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    repost: { findUnique: vi.fn(), create: vi.fn() },
    post: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { createQuoteRepost } from "@/app/feed/post-actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockCreateNotification = vi.mocked(createNotification);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const initial = { success: false, message: "" };

describe("createQuoteRepost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", username: "alice" },
      expires: "",
    });
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const fd = makeFormData({ postId: "p1", content: "great post" });
    const result = await createQuoteRepost(initial, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if content is empty", async () => {
    const fd = makeFormData({ postId: "p1", content: "" });
    const result = await createQuoteRepost(initial, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Quote text cannot be empty");
  });

  it("returns error if content is whitespace only", async () => {
    const fd = makeFormData({ postId: "p1", content: "   " });
    const result = await createQuoteRepost(initial, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Quote text cannot be empty");
  });

  it("returns error if content exceeds 500 characters", async () => {
    const fd = makeFormData({ postId: "p1", content: "a".repeat(501) });
    const result = await createQuoteRepost(initial, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Quote text too long (max 500 characters)");
  });

  it("returns error if already reposted", async () => {
    mockPrisma.repost.findUnique.mockResolvedValue({
      id: "r1",
      postId: "p1",
      userId: "u1",
      content: null,
      createdAt: new Date(),
    });
    const fd = makeFormData({ postId: "p1", content: "my quote" });
    const result = await createQuoteRepost(initial, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("You have already reposted this post");
  });

  it("creates repost with content on success", async () => {
    mockPrisma.repost.findUnique.mockResolvedValue(null);
    mockPrisma.repost.create.mockResolvedValue({
      id: "r1",
      postId: "p1",
      userId: "u1",
      content: "my thoughts",
      createdAt: new Date(),
    });
    mockPrisma.post.findUnique.mockResolvedValue({
      id: "p1",
      authorId: "u2",
    } as never);

    const fd = makeFormData({ postId: "p1", content: "my thoughts" });
    const result = await createQuoteRepost(initial, fd);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Quote posted");
    expect(mockPrisma.repost.create).toHaveBeenCalledWith({
      data: { postId: "p1", userId: "u1", content: "my thoughts" },
    });
  });

  it("creates REPOST notification", async () => {
    mockPrisma.repost.findUnique.mockResolvedValue(null);
    mockPrisma.repost.create.mockResolvedValue({
      id: "r1",
      postId: "p1",
      userId: "u1",
      content: "nice",
      createdAt: new Date(),
    });
    mockPrisma.post.findUnique.mockResolvedValue({
      id: "p1",
      authorId: "u2",
    } as never);

    const fd = makeFormData({ postId: "p1", content: "nice" });
    await createQuoteRepost(initial, fd);

    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "REPOST",
      actorId: "u1",
      targetUserId: "u2",
      postId: "p1",
    });
  });

  it("revalidates correct paths", async () => {
    mockPrisma.repost.findUnique.mockResolvedValue(null);
    mockPrisma.repost.create.mockResolvedValue({
      id: "r1",
      postId: "p1",
      userId: "u1",
      content: "cool",
      createdAt: new Date(),
    });
    mockPrisma.post.findUnique.mockResolvedValue({
      id: "p1",
      authorId: "u2",
    } as never);

    const fd = makeFormData({ postId: "p1", content: "cool" });
    await createQuoteRepost(initial, fd);

    expect(mockRevalidatePath).toHaveBeenCalledWith("/feed");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/post/p1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/alice");
  });
});
