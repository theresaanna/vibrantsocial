import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    like: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    bookmark: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    repost: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    repostLike: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    repostBookmark: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    repostComment: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    tag: {
      upsert: vi.fn().mockResolvedValue({ id: "tag1", name: "test" }),
    },
    repostTag: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/phone-gate", () => ({
  requirePhoneVerification: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/ably", () => ({
  getAblyRestClient: vi.fn().mockReturnValue({
    channels: {
      get: vi.fn().mockReturnValue({
        publish: vi.fn().mockResolvedValue(undefined),
      }),
    },
  }),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    send: vi.fn(),
  },
}));

vi.mock("@/lib/mentions", () => ({
  extractMentionsFromPlainText: vi.fn().mockReturnValue([]),
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

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { createNotification } from "@/lib/notifications";
import {
  fetchComments,
  toggleLike,
  toggleBookmark,
  toggleRepost,
  createQuoteRepost,
  editRepost,
  togglePinRepost,
  deleteRepost,
  createComment,
  fetchRepostComments,
  toggleRepostLike,
  toggleRepostBookmark,
  createRepostComment,
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

/* ── fetchComments ─────────────────────────────────── */

describe("fetchComments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns serialized comments", async () => {
    const comments = [
      {
        id: "c1",
        content: "Hello",
        createdAt: new Date("2024-01-01"),
        author: { id: "a1", username: "alice" },
        replies: [],
      },
    ];
    mockPrisma.comment.findMany.mockResolvedValueOnce(comments as never);

    const result = await fetchComments("p1");
    expect(result).toEqual(JSON.parse(JSON.stringify(comments)));
    expect(mockPrisma.comment.findMany).toHaveBeenCalledWith({
      where: { postId: "p1", parentId: null },
      orderBy: { createdAt: "asc" },
      include: expect.objectContaining({
        author: expect.any(Object),
        replies: expect.any(Object),
      }),
    });
  });
});

/* ── toggleLike ────────────────────────────────────── */

describe("toggleLike", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await toggleLike(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("unlikes when already liked", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.like.findUnique.mockResolvedValueOnce({ id: "l1" } as never);
    mockPrisma.like.delete.mockResolvedValueOnce({} as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      author: { username: "alice" },
    } as never);

    const result = await toggleLike(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Unliked");
    expect(mockPrisma.like.delete).toHaveBeenCalledWith({ where: { id: "l1" } });
  });

  it("likes and creates notification", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.like.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.like.create.mockResolvedValueOnce({} as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      authorId: "author1",
      author: { username: "alice" },
    } as never);

    const result = await toggleLike(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Liked");
    expect(mockPrisma.like.create).toHaveBeenCalledWith({
      data: { postId: "p1", userId: "user1" },
    });
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "LIKE",
      actorId: "user1",
      targetUserId: "author1",
      postId: "p1",
    });
  });
});

/* ── toggleBookmark ──────────────────────────────────── */

describe("toggleBookmark", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await toggleBookmark(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("unbookmarks when already bookmarked", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.bookmark.findUnique.mockResolvedValueOnce({ id: "b1" } as never);
    mockPrisma.bookmark.delete.mockResolvedValueOnce({} as never);

    const result = await toggleBookmark(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Unbookmarked");
  });

  it("bookmarks and creates notification", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.bookmark.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.bookmark.create.mockResolvedValueOnce({} as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);

    const result = await toggleBookmark(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Bookmarked");
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "BOOKMARK",
      actorId: "user1",
      targetUserId: "author1",
      postId: "p1",
    });
  });
});

/* ── toggleRepost ──────────────────────────────────── */

describe("toggleRepost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await toggleRepost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("unreposts when already reposted", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({ id: "r1" } as never);
    mockPrisma.repost.delete.mockResolvedValueOnce({} as never);

    const result = await toggleRepost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Unreposted");
  });

  it("reposts and creates notification", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1", username: "bob" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.repost.create.mockResolvedValueOnce({} as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);

    const result = await toggleRepost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Reposted");
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "REPOST",
      actorId: "user1",
      targetUserId: "author1",
      postId: "p1",
    });
  });
});

/* ── createQuoteRepost ─────────────────────────────── */

describe("createQuoteRepost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await createQuoteRepost(
      prevState,
      makeFormData({ postId: "p1", content: "quote" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if content is empty", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await createQuoteRepost(
      prevState,
      makeFormData({ postId: "p1", content: "" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Quote text cannot be empty");
  });

  it("returns error if already reposted", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({ id: "existing" } as never);

    const result = await createQuoteRepost(
      prevState,
      makeFormData({ postId: "p1", content: "my quote" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("You have already reposted this post");
  });

  it("creates quote repost successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1", username: "bob" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.repost.create.mockResolvedValueOnce({ id: "qr1" } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);

    const result = await createQuoteRepost(
      prevState,
      makeFormData({ postId: "p1", content: "my quote" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Quote posted");
    expect(mockPrisma.repost.create).toHaveBeenCalledWith({
      data: {
        postId: "p1",
        userId: "user1",
        content: "my quote",
        isSensitive: false,
        isNsfw: false,
        isGraphicNudity: false,
        isCloseFriendsOnly: false,
      },
    });
  });
});

/* ── editRepost ────────────────────────────────────── */

describe("editRepost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await editRepost(
      prevState,
      makeFormData({ repostId: "r1", content: "updated" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if repostId or content missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await editRepost(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Repost ID and content required");
  });

  it("returns error if not authorized (not owner)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({
      id: "r1",
      userId: "other",
    } as never);

    const result = await editRepost(
      prevState,
      makeFormData({ repostId: "r1", content: "updated" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authorized");
  });

  it("returns error if repost not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce(null as never);

    const result = await editRepost(
      prevState,
      makeFormData({ repostId: "r1", content: "updated" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authorized");
  });

  it("updates repost successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1", username: "bob" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({
      id: "r1",
      userId: "user1",
      postId: "p1",
      content: "old content",
    } as never);
    mockPrisma.repost.update.mockResolvedValueOnce({} as never);
    mockPrisma.repostTag.deleteMany.mockResolvedValueOnce({} as never);

    const result = await editRepost(
      prevState,
      makeFormData({ repostId: "r1", content: "updated content" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Quote updated");
    expect(mockPrisma.repost.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: {
        content: "updated content",
        editedAt: expect.any(Date),
        isSensitive: false,
        isNsfw: false,
        isGraphicNudity: false,
        isCloseFriendsOnly: false,
      },
    });
  });
});

/* ── togglePinRepost ───────────────────────────────── */

describe("togglePinRepost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await togglePinRepost(prevState, makeFormData({ repostId: "r1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if repostId missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await togglePinRepost(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Repost ID required");
  });

  it("returns error if not authorized", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({
      id: "r1",
      userId: "other",
    } as never);

    const result = await togglePinRepost(prevState, makeFormData({ repostId: "r1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authorized");
  });

  it("unpins a pinned repost", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1", username: "bob" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({
      id: "r1",
      userId: "user1",
      isPinned: true,
      postId: "p1",
    } as never);
    mockPrisma.repost.update.mockResolvedValueOnce({} as never);

    const result = await togglePinRepost(prevState, makeFormData({ repostId: "r1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Quote unpinned");
  });

  it("pins a repost and unpins existing pins", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1", username: "bob" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({
      id: "r1",
      userId: "user1",
      isPinned: false,
      postId: "p1",
    } as never);
    mockPrisma.post.updateMany.mockResolvedValueOnce({ count: 0 } as never);
    mockPrisma.repost.updateMany.mockResolvedValueOnce({ count: 0 } as never);
    mockPrisma.repost.update.mockResolvedValueOnce({} as never);

    const result = await togglePinRepost(prevState, makeFormData({ repostId: "r1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Quote pinned");
    expect(mockPrisma.post.updateMany).toHaveBeenCalledWith({
      where: { authorId: "user1", isPinned: true },
      data: { isPinned: false },
    });
  });
});

/* ── deleteRepost ──────────────────────────────────── */

describe("deleteRepost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await deleteRepost(prevState, makeFormData({ repostId: "r1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if repostId missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await deleteRepost(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Repost ID required");
  });

  it("returns error if not authorized", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({
      id: "r1",
      userId: "other",
      tags: [],
    } as never);

    const result = await deleteRepost(prevState, makeFormData({ repostId: "r1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authorized");
  });

  it("deletes repost successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1", username: "bob" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({
      id: "r1",
      userId: "user1",
      postId: "p1",
      tags: [],
    } as never);
    mockPrisma.repost.delete.mockResolvedValueOnce({} as never);

    const result = await deleteRepost(prevState, makeFormData({ repostId: "r1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Quote deleted");
    expect(mockPrisma.repost.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
  });
});

/* ── createComment ─────────────────────────────────── */

describe("createComment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await createComment(
      prevState,
      makeFormData({ postId: "p1", content: "hello" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if phone not verified", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(false);

    const result = await createComment(
      prevState,
      makeFormData({ postId: "p1", content: "hello" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Phone verification required to comment");
  });

  it("returns error if content is empty", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);

    const result = await createComment(
      prevState,
      makeFormData({ postId: "p1", content: "" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Comment cannot be empty");
  });

  it("returns error if content is too long", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);

    const result = await createComment(
      prevState,
      makeFormData({ postId: "p1", content: "a".repeat(1001) })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Comment too long (max 1000 characters)");
  });

  it("creates comment successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    const createdComment = {
      id: "c1",
      content: "hello",
      parentId: null,
      postId: "p1",
      authorId: "user1",
      createdAt: new Date(),
      author: {
        id: "user1",
        username: "bob",
        displayName: "Bob",
        name: null,
        image: null,
        avatar: null,
      },
    };
    mockPrisma.comment.create.mockResolvedValueOnce(createdComment as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      authorId: "author1",
      author: { email: null, emailOnComment: false },
    } as never);

    const result = await createComment(
      prevState,
      makeFormData({ postId: "p1", content: "hello" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Comment added");
  });
});

/* ── fetchRepostComments ──────────────────────────── */

describe("fetchRepostComments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns serialized repost comments", async () => {
    const comments = [
      {
        id: "rc1",
        content: "Quote comment",
        createdAt: new Date(),
        author: { id: "a1", username: "alice" },
        replies: [],
      },
    ];
    mockPrisma.repostComment.findMany.mockResolvedValueOnce(comments as never);

    const result = await fetchRepostComments("r1");
    expect(result).toEqual(JSON.parse(JSON.stringify(comments)));
  });
});

/* ── toggleRepostLike ──────────────────────────────── */

describe("toggleRepostLike", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await toggleRepostLike(prevState, makeFormData({ repostId: "r1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("unlikes repost", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.repostLike.findUnique.mockResolvedValueOnce({ id: "rl1" } as never);
    mockPrisma.repostLike.delete.mockResolvedValueOnce({} as never);

    const result = await toggleRepostLike(prevState, makeFormData({ repostId: "r1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Unliked");
  });

  it("likes repost and creates notification", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.repostLike.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.repostLike.create.mockResolvedValueOnce({} as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({ userId: "other" } as never);

    const result = await toggleRepostLike(prevState, makeFormData({ repostId: "r1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Liked");
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "LIKE",
      actorId: "user1",
      targetUserId: "other",
      repostId: "r1",
    });
  });

  it("does not notify when liking own repost", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.repostLike.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.repostLike.create.mockResolvedValueOnce({} as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({ userId: "user1" } as never);

    await toggleRepostLike(prevState, makeFormData({ repostId: "r1" }));
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});

/* ── toggleRepostBookmark ──────────────────────────── */

describe("toggleRepostBookmark", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await toggleRepostBookmark(prevState, makeFormData({ repostId: "r1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("unbookmarks repost", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.repostBookmark.findUnique.mockResolvedValueOnce({ id: "rb1" } as never);
    mockPrisma.repostBookmark.delete.mockResolvedValueOnce({} as never);

    const result = await toggleRepostBookmark(prevState, makeFormData({ repostId: "r1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Unbookmarked");
  });

  it("bookmarks repost and creates notification", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.repostBookmark.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.repostBookmark.create.mockResolvedValueOnce({} as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({ userId: "other" } as never);

    const result = await toggleRepostBookmark(prevState, makeFormData({ repostId: "r1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Bookmarked");
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "BOOKMARK",
      actorId: "user1",
      targetUserId: "other",
      repostId: "r1",
    });
  });
});

/* ── createRepostComment ───────────────────────────── */

describe("createRepostComment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await createRepostComment(
      prevState,
      makeFormData({ repostId: "r1", content: "hello" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if phone not verified", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(false);

    const result = await createRepostComment(
      prevState,
      makeFormData({ repostId: "r1", content: "hello" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Phone verification required to comment");
  });

  it("returns error if content is empty", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);

    const result = await createRepostComment(
      prevState,
      makeFormData({ repostId: "r1", content: "" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Comment cannot be empty");
  });

  it("returns error if content is too long", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);

    const result = await createRepostComment(
      prevState,
      makeFormData({ repostId: "r1", content: "x".repeat(1001) })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Comment too long (max 1000 characters)");
  });

  it("creates repost comment successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    const createdComment = {
      id: "rc1",
      content: "hello",
      parentId: null,
      repostId: "r1",
      authorId: "user1",
      createdAt: new Date(),
      author: {
        id: "user1",
        username: "bob",
        displayName: "Bob",
        name: null,
        image: null,
        avatar: null,
      },
    };
    mockPrisma.repostComment.create.mockResolvedValueOnce(createdComment as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({ userId: "other" } as never);

    const result = await createRepostComment(
      prevState,
      makeFormData({ repostId: "r1", content: "hello" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Comment added");
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "COMMENT",
      actorId: "user1",
      targetUserId: "other",
      repostId: "r1",
    });
  });

  it("does not notify when commenting on own repost", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.repostComment.create.mockResolvedValueOnce({
      id: "rc1",
      content: "hello",
      parentId: null,
      createdAt: new Date(),
      author: { id: "user1", username: "bob", displayName: "Bob", name: null, image: null, avatar: null },
    } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({ userId: "user1" } as never);

    await createRepostComment(
      prevState,
      makeFormData({ repostId: "r1", content: "hello" })
    );
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});
