import { describe, it, expect, vi, beforeEach } from "vitest";
import { toggleLike, toggleBookmark, toggleRepost, createComment } from "@/app/feed/post-actions";
import { toggleFollow } from "@/app/feed/follow-actions";

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
    bookmark: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    repost: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
    },
    comment: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    follow: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: {
    userFollowing: (id: string) => `following:${id}`,
    userProfile: (username: string) => `profile:${username}`,
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

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockPhoneGate = vi.mocked(requirePhoneVerification);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };

describe("toggleLike", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await toggleLike(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(false);
  });

  it("creates like if not already liked", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.like.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.like.create.mockResolvedValueOnce({} as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);

    const result = await toggleLike(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Liked");
    expect(mockPrisma.like.create).toHaveBeenCalled();
  });

  it("removes like if already liked", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.like.findUnique.mockResolvedValueOnce({ id: "like1" } as never);
    mockPrisma.like.delete.mockResolvedValueOnce({} as never);

    const result = await toggleLike(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Unliked");
    expect(mockPrisma.like.delete).toHaveBeenCalledWith({ where: { id: "like1" } });
  });
});

describe("toggleBookmark", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates bookmark if not bookmarked", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.bookmark.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.bookmark.create.mockResolvedValueOnce({} as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);

    const result = await toggleBookmark(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Bookmarked");
  });

  it("removes bookmark if already bookmarked", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.bookmark.findUnique.mockResolvedValueOnce({ id: "bm1" } as never);
    mockPrisma.bookmark.delete.mockResolvedValueOnce({} as never);

    const result = await toggleBookmark(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Unbookmarked");
  });
});

describe("toggleRepost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates repost if not reposted", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.repost.create.mockResolvedValueOnce({} as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);

    const result = await toggleRepost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Reposted");
  });

  it("removes repost if already reposted", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.repost.findUnique.mockResolvedValueOnce({ id: "rp1" } as never);
    mockPrisma.repost.delete.mockResolvedValueOnce({} as never);

    const result = await toggleRepost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Unreposted");
  });
});

describe("createComment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await createComment(prevState, makeFormData({ content: "test" }));
    expect(result.success).toBe(false);
  });

  it("requires phone verification", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(false);

    const result = await createComment(prevState, makeFormData({ content: "test", postId: "p1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Phone verification required to comment");
  });

  it("rejects empty comments", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);

    const result = await createComment(
      prevState,
      makeFormData({ content: "   ", postId: "p1" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Comment cannot be empty");
  });

  it("rejects comments over 1000 characters", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);

    const result = await createComment(
      prevState,
      makeFormData({ content: "a".repeat(1001), postId: "p1" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Comment too long (max 1000 characters)");
  });

  const authorInclude = {
    author: {
      select: {
        id: true,
        username: true,
        displayName: true,
        name: true,
        image: true,
        avatar: true,
        profileFrameId: true,
      },
    },
  };

  const fakeComment = {
    id: "c1",
    content: "Great post!",
    postId: "p1",
    authorId: "user1",
    parentId: null,
    createdAt: new Date(),
    author: { id: "user1", username: "u1", displayName: null, name: "User", image: null, avatar: null, profileFrameId: null },
  };

  it("creates comment successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.comment.create.mockResolvedValueOnce(fakeComment as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      authorId: "author1",
      author: { email: null, emailOnComment: true },
    } as never);

    const result = await createComment(
      prevState,
      makeFormData({ content: "Great post!", postId: "p1" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Comment added");
    expect(mockPrisma.comment.create).toHaveBeenCalledWith({
      data: { content: "Great post!", postId: "p1", authorId: "user1", parentId: null },
      include: authorInclude,
    });
  });

  it("creates reply to a comment with parentId", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.comment.create.mockResolvedValueOnce({ ...fakeComment, parentId: "c1" } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      authorId: "author1",
      author: { email: null, emailOnComment: true },
    } as never);
    mockPrisma.comment.findUnique.mockResolvedValueOnce({ authorId: "parent-author" } as never);

    const result = await createComment(
      prevState,
      makeFormData({ content: "Great reply!", postId: "p1", parentId: "c1" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Comment added");
    expect(mockPrisma.comment.create).toHaveBeenCalledWith({
      data: { content: "Great reply!", postId: "p1", authorId: "user1", parentId: "c1" },
      include: authorInclude,
    });
  });
});

describe("toggleFollow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await toggleFollow(prevState, makeFormData({ userId: "u2" }));
    expect(result.success).toBe(false);
  });

  it("prevents following yourself", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await toggleFollow(prevState, makeFormData({ userId: "user1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Cannot follow yourself");
  });

  it("creates single follow if not following", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.follow.findUnique.mockResolvedValueOnce(null as never);

    const result = await toggleFollow(prevState, makeFormData({ userId: "user2" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Followed");
    expect(mockPrisma.follow.create).toHaveBeenCalledWith({
      data: { followerId: "user1", followingId: "user2" },
    });
  });

  it("removes single follow if already following", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.follow.findUnique.mockResolvedValueOnce({ id: "f1" } as never);
    mockPrisma.follow.delete.mockResolvedValueOnce({ id: "f1" } as never);

    const result = await toggleFollow(prevState, makeFormData({ userId: "user2" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Unfollowed");
    expect(mockPrisma.follow.delete).toHaveBeenCalledWith({ where: { id: "f1" } });
  });
});
