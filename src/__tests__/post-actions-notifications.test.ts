import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    like: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    bookmark: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    repost: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    post: { findUnique: vi.fn() },
    comment: { create: vi.fn(), findUnique: vi.fn() },
    user: { update: vi.fn() },
  },
}));

vi.mock("@/lib/phone-gate", () => ({
  requirePhoneVerification: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendCommentEmail: vi.fn(),
}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockAblyPublish = vi.fn();
vi.mock("@/lib/ably", () => ({
  getAblyRestClient: () => ({
    channels: {
      get: () => ({ publish: mockAblyPublish }),
    },
  }),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { createNotification } from "@/lib/notifications";
import {
  toggleLike,
  toggleBookmark,
  toggleRepost,
  createComment,
} from "@/app/feed/post-actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockPhoneGate = vi.mocked(requirePhoneVerification);
const mockCreateNotification = vi.mocked(createNotification);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };

describe("post actions → notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  /* ── toggleLike ──────────────────────────────────── */

  describe("toggleLike", () => {
    it("creates LIKE notification when liking a post", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.like.findUnique.mockResolvedValueOnce(null as never);
      mockPrisma.like.create.mockResolvedValueOnce({} as never);
      mockPrisma.post.findUnique.mockResolvedValueOnce({
        authorId: "author1",
      } as never);

      await toggleLike(prevState, makeFormData({ postId: "p1" }));

      expect(mockCreateNotification).toHaveBeenCalledWith({
        type: "LIKE",
        actorId: "u1",
        targetUserId: "author1",
        postId: "p1",
      });
    });

    it("does not create notification when unliking", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.like.findUnique.mockResolvedValueOnce({
        id: "l1",
      } as never);
      mockPrisma.like.delete.mockResolvedValueOnce({} as never);

      await toggleLike(prevState, makeFormData({ postId: "p1" }));

      expect(mockCreateNotification).not.toHaveBeenCalled();
    });
  });

  /* ── toggleBookmark ──────────────────────────────── */

  describe("toggleBookmark", () => {
    it("creates BOOKMARK notification when bookmarking", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.bookmark.findUnique.mockResolvedValueOnce(null as never);
      mockPrisma.bookmark.create.mockResolvedValueOnce({} as never);
      mockPrisma.post.findUnique.mockResolvedValueOnce({
        authorId: "author1",
      } as never);

      await toggleBookmark(prevState, makeFormData({ postId: "p1" }));

      expect(mockCreateNotification).toHaveBeenCalledWith({
        type: "BOOKMARK",
        actorId: "u1",
        targetUserId: "author1",
        postId: "p1",
      });
    });

    it("does not create notification when unbookmarking", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.bookmark.findUnique.mockResolvedValueOnce({
        id: "b1",
      } as never);
      mockPrisma.bookmark.delete.mockResolvedValueOnce({} as never);

      await toggleBookmark(prevState, makeFormData({ postId: "p1" }));

      expect(mockCreateNotification).not.toHaveBeenCalled();
    });
  });

  /* ── toggleRepost ────────────────────────────────── */

  describe("toggleRepost", () => {
    it("creates REPOST notification when reposting", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.repost.findUnique.mockResolvedValueOnce(null as never);
      mockPrisma.repost.create.mockResolvedValueOnce({} as never);
      mockPrisma.post.findUnique.mockResolvedValueOnce({
        authorId: "author1",
      } as never);

      await toggleRepost(prevState, makeFormData({ postId: "p1" }));

      expect(mockCreateNotification).toHaveBeenCalledWith({
        type: "REPOST",
        actorId: "u1",
        targetUserId: "author1",
        postId: "p1",
      });
    });

    it("does not create notification when unreposting", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.repost.findUnique.mockResolvedValueOnce({
        id: "r1",
      } as never);
      mockPrisma.repost.delete.mockResolvedValueOnce({} as never);

      await toggleRepost(prevState, makeFormData({ postId: "p1" }));

      expect(mockCreateNotification).not.toHaveBeenCalled();
    });
  });

  /* ── createComment ───────────────────────────────── */

  describe("createComment", () => {
    it("creates COMMENT notification for post author", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPhoneGate.mockResolvedValueOnce(true);
      mockPrisma.comment.create.mockResolvedValueOnce({
        id: "c1",
        content: "Nice!",
        parentId: null,
        createdAt: new Date(),
        author: { id: "u1", username: "alice" },
      } as never);
      mockPrisma.post.findUnique.mockResolvedValueOnce({
        authorId: "author1",
        author: { email: null, emailOnComment: true },
      } as never);

      await createComment(
        prevState,
        makeFormData({ postId: "p1", content: "Nice!" })
      );

      expect(mockCreateNotification).toHaveBeenCalledWith({
        type: "COMMENT",
        actorId: "u1",
        targetUserId: "author1",
        postId: "p1",
        commentId: "c1",
      });
    });

    it("creates REPLY notification for parent comment author", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPhoneGate.mockResolvedValueOnce(true);
      mockPrisma.comment.create.mockResolvedValueOnce({
        id: "c2",
        content: "Thanks!",
        parentId: "c1",
        createdAt: new Date(),
        author: { id: "u1", username: "alice" },
      } as never);
      // First findUnique call is for post author
      mockPrisma.post.findUnique.mockResolvedValueOnce({
        authorId: "author1",
        author: { email: null, emailOnComment: true },
      } as never);
      // Second findUnique call is for parent comment author
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        authorId: "parent-author",
      } as never);

      await createComment(
        prevState,
        makeFormData({ postId: "p1", content: "Thanks!", parentId: "c1" })
      );

      // Should create both COMMENT and REPLY notifications
      expect(mockCreateNotification).toHaveBeenCalledTimes(2);
      expect(mockCreateNotification).toHaveBeenCalledWith({
        type: "COMMENT",
        actorId: "u1",
        targetUserId: "author1",
        postId: "p1",
        commentId: "c2",
      });
      expect(mockCreateNotification).toHaveBeenCalledWith({
        type: "REPLY",
        actorId: "u1",
        targetUserId: "parent-author",
        postId: "p1",
        commentId: "c2",
      });
    });

    it("does not create duplicate REPLY when parent author is post author", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPhoneGate.mockResolvedValueOnce(true);
      mockPrisma.comment.create.mockResolvedValueOnce({
        id: "c2",
        content: "Thanks!",
        parentId: "c1",
        createdAt: new Date(),
        author: { id: "u1", username: "alice" },
      } as never);
      mockPrisma.post.findUnique.mockResolvedValueOnce({
        authorId: "author1",
        author: { email: null, emailOnComment: true },
      } as never);
      // Parent comment author is the same as post author
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        authorId: "author1",
      } as never);

      await createComment(
        prevState,
        makeFormData({ postId: "p1", content: "Thanks!", parentId: "c1" })
      );

      // Only COMMENT notification, no duplicate REPLY
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
      expect(mockCreateNotification).toHaveBeenCalledWith({
        type: "COMMENT",
        actorId: "u1",
        targetUserId: "author1",
        postId: "p1",
        commentId: "c2",
      });
    });

    it("no notification when liking own post (self-notification handled by createNotification)", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.like.findUnique.mockResolvedValueOnce(null as never);
      mockPrisma.like.create.mockResolvedValueOnce({} as never);
      // Post author is the same user
      mockPrisma.post.findUnique.mockResolvedValueOnce({
        authorId: "u1",
      } as never);

      await toggleLike(prevState, makeFormData({ postId: "p1" }));

      // createNotification is called but the helper itself skips self-notifications
      expect(mockCreateNotification).toHaveBeenCalledWith({
        type: "LIKE",
        actorId: "u1",
        targetUserId: "u1",
        postId: "p1",
      });
    });
  });
});

describe("post actions → revalidation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toggleLike revalidates /feed, /post/[id], and /likes", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.like.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.like.create.mockResolvedValueOnce({} as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "a1" } as never);

    await toggleLike(prevState, makeFormData({ postId: "p1" }));

    expect(mockRevalidatePath).toHaveBeenCalledWith("/feed");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/post/p1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/likes");
  });

  it("toggleBookmark revalidates /feed, /post/[id], and /bookmarks", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.bookmark.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.bookmark.create.mockResolvedValueOnce({} as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "a1" } as never);

    await toggleBookmark(prevState, makeFormData({ postId: "p1" }));

    expect(mockRevalidatePath).toHaveBeenCalledWith("/feed");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/post/p1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/bookmarks");
  });

  it("toggleRepost revalidates /feed and /post/[id]", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.repost.create.mockResolvedValueOnce({} as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "a1" } as never);

    await toggleRepost(prevState, makeFormData({ postId: "p1" }));

    expect(mockRevalidatePath).toHaveBeenCalledWith("/feed");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/post/p1");
  });

  it("createComment revalidates /feed and /post/[id]", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.comment.create.mockResolvedValueOnce({
      id: "c1",
      content: "Nice!",
      parentId: null,
      createdAt: new Date(),
      author: { id: "u1", username: "alice" },
    } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      authorId: "a1",
      author: { email: null, emailOnComment: true },
    } as never);

    await createComment(prevState, makeFormData({ postId: "p1", content: "Nice!" }));

    expect(mockRevalidatePath).toHaveBeenCalledWith("/feed");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/post/p1");
  });
});
