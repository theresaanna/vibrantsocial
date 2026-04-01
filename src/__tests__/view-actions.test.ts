import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
    },
    postView: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: null,
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

import { recordPostView } from "@/app/feed/view-actions";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockIsRateLimited = vi.mocked(isRateLimited);

describe("recordPostView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as any);
    mockPrisma.post.findUnique.mockResolvedValue({ authorId: "author1" } as any);
    mockPrisma.postView.create.mockResolvedValue({ id: "view1" } as any);
    mockIsRateLimited.mockResolvedValue(false);
  });

  it("records a view for an authenticated user", async () => {
    await recordPostView({ postId: "post1", source: "feed" });

    expect(mockPrisma.postView.create).toHaveBeenCalledWith({
      data: {
        postId: "post1",
        userId: "user1",
        source: "feed",
        referrer: null,
      },
    });
  });

  it("records a view for an anonymous user", async () => {
    mockAuth.mockResolvedValue(null as any);

    await recordPostView({ postId: "post1", source: "direct" });

    expect(mockPrisma.postView.create).toHaveBeenCalledWith({
      data: {
        postId: "post1",
        userId: null,
        source: "direct",
        referrer: null,
      },
    });
  });

  it("does not record a view for the post author", async () => {
    mockPrisma.post.findUnique.mockResolvedValue({ authorId: "user1" } as any);

    await recordPostView({ postId: "post1", source: "feed" });

    expect(mockPrisma.postView.create).not.toHaveBeenCalled();
  });

  it("stores the referrer when provided", async () => {
    await recordPostView({
      postId: "post1",
      source: "external",
      referrer: "https://google.com",
    });

    expect(mockPrisma.postView.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ referrer: "https://google.com" }),
    });
  });

  it("silently rejects invalid input", async () => {
    await recordPostView({ postId: "", source: "feed" });
    expect(mockPrisma.postView.create).not.toHaveBeenCalled();

    await recordPostView({ postId: "post1", source: "invalid-source" });
    expect(mockPrisma.postView.create).not.toHaveBeenCalled();
  });

  it("respects rate limiting", async () => {
    mockIsRateLimited.mockResolvedValue(true);

    await recordPostView({ postId: "post1", source: "feed" });

    expect(mockPrisma.postView.create).not.toHaveBeenCalled();
  });

  it("does not record when the post does not exist", async () => {
    mockPrisma.post.findUnique.mockResolvedValue(null);

    await recordPostView({ postId: "nonexistent", source: "feed" });

    expect(mockPrisma.postView.create).not.toHaveBeenCalled();
  });

  it("does not throw on database errors", async () => {
    mockPrisma.postView.create.mockRejectedValue(new Error("DB error"));

    await expect(
      recordPostView({ postId: "post1", source: "feed" }),
    ).resolves.toBeUndefined();
  });
});
