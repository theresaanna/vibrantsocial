import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    commentSubscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  toggleCommentSubscription,
  isSubscribedToComments,
} from "@/app/feed/comment-subscription-actions";

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

describe("toggleCommentSubscription", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a subscription when none exists", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.commentSubscription.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.commentSubscription.create.mockResolvedValueOnce({} as never);

    const result = await toggleCommentSubscription(
      prevState,
      makeFormData({ postId: "p1" })
    );

    expect(result).toEqual({ success: true, message: "Subscribed to comments" });
    expect(mockPrisma.commentSubscription.create).toHaveBeenCalledWith({
      data: { userId: "u1", postId: "p1" },
    });
  });

  it("deletes the subscription when one exists", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.commentSubscription.findUnique.mockResolvedValueOnce({
      id: "sub1",
    } as never);

    const result = await toggleCommentSubscription(
      prevState,
      makeFormData({ postId: "p1" })
    );

    expect(result).toEqual({ success: true, message: "Unsubscribed from comments" });
    expect(mockPrisma.commentSubscription.delete).toHaveBeenCalledWith({
      where: { id: "sub1" },
    });
  });

  it("returns error when postId is missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);

    const result = await toggleCommentSubscription(
      prevState,
      makeFormData({})
    );

    expect(result).toEqual({ success: false, message: "Post ID required" });
  });

  it("looks up subscription with correct compound key", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.commentSubscription.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.commentSubscription.create.mockResolvedValueOnce({} as never);

    await toggleCommentSubscription(
      prevState,
      makeFormData({ postId: "p1" })
    );

    expect(mockPrisma.commentSubscription.findUnique).toHaveBeenCalledWith({
      where: {
        userId_postId: { userId: "u1", postId: "p1" },
      },
    });
  });

  it("revalidates the post path after subscribing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.commentSubscription.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.commentSubscription.create.mockResolvedValueOnce({} as never);

    await toggleCommentSubscription(
      prevState,
      makeFormData({ postId: "p1" })
    );

    expect(mockRevalidatePath).toHaveBeenCalledWith("/post/p1");
  });
});

describe("isSubscribedToComments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when subscribed", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.commentSubscription.findUnique.mockResolvedValueOnce({
      id: "sub1",
    } as never);

    expect(await isSubscribedToComments("p1")).toBe(true);
  });

  it("returns false when not subscribed", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.commentSubscription.findUnique.mockResolvedValueOnce(null as never);

    expect(await isSubscribedToComments("p1")).toBe(false);
  });

  it("returns false when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    expect(await isSubscribedToComments("p1")).toBe(false);
  });
});
