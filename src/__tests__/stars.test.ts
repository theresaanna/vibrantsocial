import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toggleLike,
  toggleRepost,
  createQuoteRepost,
  createComment,
  toggleRepostLike,
  createRepostComment,
} from "@/app/feed/post-actions";
import { createPost } from "@/app/feed/actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    like: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    repost: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "repost1" }),
      delete: vi.fn(),
    },
    repostLike: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    repostComment: {
      create: vi.fn().mockResolvedValue({
        id: "rc1",
        content: "test",
        author: { id: "user1", username: "u1" },
      }),
    },
    post: {
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "post1" }),
    },
    comment: {
      create: vi.fn().mockResolvedValue({
        id: "c1",
        content: "test",
        author: { id: "user1", username: "u1" },
      }),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tag: {
      upsert: vi.fn().mockResolvedValue({ id: "tag1", name: "test" }),
    },
    postTag: {
      create: vi.fn(),
    },
    repostTag: {
      create: vi.fn(),
    },
    postSubscription: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendCommentEmail: vi.fn(),
}));

vi.mock("@/lib/phone-gate", () => ({
  requirePhoneVerification: vi.fn(),
}));

vi.mock("@/lib/age-gate", () => ({
  requireMinimumAge: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: {
    tagCloud: () => "tagCloud",
    nsfwTagCloud: () => "nsfwTagCloud",
    tagPostCount: (name: string) => `tagPostCount:${name}`,
  },
}));

const mockAblyPublish = vi.fn();
vi.mock("@/lib/ably", () => ({
  getAblyRestClient: () => ({
    channels: {
      get: () => ({ publish: mockAblyPublish }),
    },
  }),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { send: vi.fn() },
}));

vi.mock("@/lib/mentions", () => ({
  extractMentionsFromPlainText: vi.fn().mockReturnValue([]),
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

vi.mock("@/lib/slugs", () => ({
  generateSlugFromContent: vi.fn().mockReturnValue("test-slug"),
  validateSlug: vi.fn((s: string) => s),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireMinimumAge } from "@/lib/age-gate";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockPhoneGate = vi.mocked(requirePhoneVerification);
const mockAgeGate = vi.mocked(requireMinimumAge);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };

// A valid Lexical JSON content string (> 50 chars when stringified)
const validLexicalContent = JSON.stringify({
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "This is a test post with enough content to pass validation checks.",
            type: "text",
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      },
    ],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
});

describe("Stars system", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("toggleLike", () => {
    it("increments stars when liking a post", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPrisma.like.findUnique.mockResolvedValueOnce(null as never);
      mockPrisma.like.create.mockResolvedValueOnce({} as never);
      mockPrisma.post.findUnique.mockResolvedValueOnce({
        authorId: "author1",
        author: { username: "author" },
      } as never);

      await toggleLike(prevState, makeFormData({ postId: "p1" }));

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user1" },
        data: { stars: { increment: 1 } },
      });
    });

    it("decrements stars when unliking a post", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPrisma.like.findUnique.mockResolvedValueOnce({ id: "like1" } as never);
      mockPrisma.like.delete.mockResolvedValueOnce({} as never);
      mockPrisma.post.findUnique.mockResolvedValueOnce({
        author: { username: "author" },
      } as never);

      await toggleLike(prevState, makeFormData({ postId: "p1" }));

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user1" },
        data: { stars: { decrement: 1 } },
      });
    });

    it("does not update stars when not authenticated", async () => {
      mockAuth.mockResolvedValueOnce(null as never);

      await toggleLike(prevState, makeFormData({ postId: "p1" }));

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("toggleRepost", () => {
    it("increments stars when reposting", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPrisma.repost.findUnique.mockResolvedValueOnce(null as never);
      mockPrisma.repost.create.mockResolvedValueOnce({} as never);
      mockPrisma.post.findUnique.mockResolvedValueOnce({
        authorId: "author1",
      } as never);

      await toggleRepost(prevState, makeFormData({ postId: "p1" }));

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user1" },
        data: { stars: { increment: 1 } },
      });
    });

    it("decrements stars when un-reposting", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPrisma.repost.findUnique.mockResolvedValueOnce({ id: "r1" } as never);
      mockPrisma.repost.delete.mockResolvedValueOnce({} as never);

      await toggleRepost(prevState, makeFormData({ postId: "p1" }));

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user1" },
        data: { stars: { decrement: 1 } },
      });
    });
  });

  describe("createQuoteRepost", () => {
    it("increments stars when creating a quote post", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1", username: "u1" } } as never);
      mockPrisma.repost.findUnique.mockResolvedValueOnce(null as never);
      mockPrisma.repost.create.mockResolvedValueOnce({ id: "repost1" } as never);
      mockPrisma.post.findUnique.mockResolvedValueOnce({
        authorId: "author1",
      } as never);

      await createQuoteRepost(
        prevState,
        makeFormData({ postId: "p1", content: validLexicalContent })
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user1" },
        data: { stars: { increment: 1 } },
      });
    });
  });

  describe("createComment", () => {
    it("increments stars when creating a comment", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPhoneGate.mockResolvedValueOnce(true);
      mockPrisma.comment.create.mockResolvedValueOnce({
        id: "c1",
        content: "test comment",
        author: { id: "user1", username: "u1" },
      } as never);
      mockPrisma.post.findUnique.mockResolvedValueOnce({
        authorId: "author1",
        author: { email: null, emailOnComment: false },
      } as never);

      await createComment(
        prevState,
        makeFormData({ postId: "p1", content: "test comment" })
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user1" },
        data: { stars: { increment: 1 } },
      });
    });
  });

  describe("toggleRepostLike", () => {
    it("increments stars when liking a quote post", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPrisma.repostLike.findUnique.mockResolvedValueOnce(null as never);
      mockPrisma.repostLike.create.mockResolvedValueOnce({} as never);
      mockPrisma.repost.findUnique.mockResolvedValueOnce({
        userId: "author1",
      } as never);

      await toggleRepostLike(
        prevState,
        makeFormData({ repostId: "r1" })
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user1" },
        data: { stars: { increment: 1 } },
      });
    });

    it("decrements stars when unliking a quote post", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPrisma.repostLike.findUnique.mockResolvedValueOnce({ id: "rl1" } as never);
      mockPrisma.repostLike.delete.mockResolvedValueOnce({} as never);

      await toggleRepostLike(
        prevState,
        makeFormData({ repostId: "r1" })
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user1" },
        data: { stars: { decrement: 1 } },
      });
    });
  });

  describe("createRepostComment", () => {
    it("increments stars when commenting on a quote post", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPhoneGate.mockResolvedValueOnce(true);
      mockPrisma.repostComment.create.mockResolvedValueOnce({
        id: "rc1",
        content: "test",
        author: { id: "user1", username: "u1" },
      } as never);
      mockPrisma.repost.findUnique.mockResolvedValueOnce({
        userId: "author1",
      } as never);

      await createRepostComment(
        prevState,
        makeFormData({ repostId: "r1", content: "test comment" })
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user1" },
        data: { stars: { increment: 1 } },
      });
    });
  });

  describe("createPost", () => {
    it("increments stars when creating a post", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1", username: "u1" } } as never);
      mockPhoneGate.mockResolvedValueOnce(true);
      mockAgeGate.mockResolvedValueOnce(true);
      mockPrisma.post.create.mockResolvedValueOnce({ id: "post1" } as never);
      mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

      await createPost(
        prevState,
        makeFormData({ content: validLexicalContent })
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user1" },
        data: { stars: { increment: 1 } },
      });
    });
  });
});
