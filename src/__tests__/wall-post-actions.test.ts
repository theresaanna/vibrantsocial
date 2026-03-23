import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createWallPost,
  updateWallPostStatus,
  deleteWallPost,
} from "@/app/feed/wall-post-actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    friendRequest: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    post: {
      create: vi.fn(),
      delete: vi.fn(),
    },
    wallPost: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: {},
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/phone-gate", () => ({
  requirePhoneVerification: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/age-gate", () => ({
  requireMinimumAge: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/suspension-gate", () => ({
  requireNotSuspended: vi.fn().mockResolvedValue(true),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/mentions", () => ({
  extractMentionsFromLexicalJson: vi.fn().mockReturnValue([]),
  createMentionNotifications: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockCreateNotification = vi.mocked(createNotification);

const prevState = { success: false, message: "" };

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const validContent = JSON.stringify({
  root: {
    children: [
      {
        children: [{ text: "Hello this is a wall post with enough content to pass validation" }],
        type: "paragraph",
      },
    ],
    type: "root",
  },
});

describe("createWallPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await createWallPost(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if wallOwnerId is missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await createWallPost(
      prevState,
      makeFormData({ content: validContent })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Wall owner is required");
  });

  it("returns error if posting on own wall", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await createWallPost(
      prevState,
      makeFormData({ wallOwnerId: "user1", content: validContent })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("You cannot post on your own wall");
  });

  it("returns error if content is empty", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await createWallPost(
      prevState,
      makeFormData({ wallOwnerId: "user2" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Post content is required");
  });

  it("returns error if not friends", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce(null);
    const result = await createWallPost(
      prevState,
      makeFormData({ wallOwnerId: "user2", content: validContent })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Only friends can post on each other's walls");
  });

  it("creates wall post successfully when friends", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce({
      id: "fr1",
      senderId: "user1",
      receiverId: "user2",
      status: "ACCEPTED",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "wallowner",
    } as never);
    mockPrisma.post.create.mockResolvedValueOnce({
      id: "post1",
      content: validContent,
      authorId: "user1",
    } as never);
    mockPrisma.wallPost.create.mockResolvedValueOnce({
      id: "wp1",
      postId: "post1",
      wallOwnerId: "user2",
      status: "pending",
    } as never);

    const result = await createWallPost(
      prevState,
      makeFormData({ wallOwnerId: "user2", content: validContent })
    );

    expect(result.success).toBe(true);
    expect(result.postId).toBe("post1");
    expect(mockPrisma.post.create).toHaveBeenCalledWith({
      data: { content: validContent, authorId: "user1" },
    });
    expect(mockPrisma.wallPost.create).toHaveBeenCalledWith({
      data: { postId: "post1", wallOwnerId: "user2" },
    });
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "WALL_POST",
      actorId: "user1",
      targetUserId: "user2",
      postId: "post1",
    });
  });
});

describe("updateWallPostStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await updateWallPostStatus(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error for invalid status", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await updateWallPostStatus(
      prevState,
      makeFormData({ wallPostId: "wp1", status: "invalid" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid status");
  });

  it("returns error if wall post not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.wallPost.findUnique.mockResolvedValueOnce(null);
    const result = await updateWallPostStatus(
      prevState,
      makeFormData({ wallPostId: "wp1", status: "accepted" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Wall post not found");
  });

  it("returns error if not the wall owner", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.wallPost.findUnique.mockResolvedValueOnce({
      id: "wp1",
      wallOwnerId: "user2",
      wallOwner: { username: "wallowner" },
    } as never);
    const result = await updateWallPostStatus(
      prevState,
      makeFormData({ wallPostId: "wp1", status: "accepted" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Only the wall owner can moderate wall posts");
  });

  it("accepts wall post when owner", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.wallPost.findUnique.mockResolvedValueOnce({
      id: "wp1",
      wallOwnerId: "user1",
      wallOwner: { username: "wallowner" },
    } as never);
    mockPrisma.wallPost.update.mockResolvedValueOnce({} as never);

    const result = await updateWallPostStatus(
      prevState,
      makeFormData({ wallPostId: "wp1", status: "accepted" })
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.wallPost.update).toHaveBeenCalledWith({
      where: { id: "wp1" },
      data: { status: "accepted" },
    });
  });

  it("hides wall post when owner", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.wallPost.findUnique.mockResolvedValueOnce({
      id: "wp1",
      wallOwnerId: "user1",
      wallOwner: { username: "wallowner" },
    } as never);
    mockPrisma.wallPost.update.mockResolvedValueOnce({} as never);

    const result = await updateWallPostStatus(
      prevState,
      makeFormData({ wallPostId: "wp1", status: "hidden" })
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe("Wall post hidden");
  });
});

describe("deleteWallPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await deleteWallPost(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if wall post not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.wallPost.findUnique.mockResolvedValueOnce(null);
    const result = await deleteWallPost(
      prevState,
      makeFormData({ wallPostId: "wp1" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Wall post not found");
  });

  it("returns error if not authorized", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user3" } } as never);
    mockPrisma.wallPost.findUnique.mockResolvedValueOnce({
      id: "wp1",
      postId: "post1",
      wallOwnerId: "user2",
      post: { authorId: "user1" },
      wallOwner: { username: "wallowner" },
    } as never);
    const result = await deleteWallPost(
      prevState,
      makeFormData({ wallPostId: "wp1" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authorized to delete this wall post");
  });

  it("allows poster to delete their wall post", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.wallPost.findUnique.mockResolvedValueOnce({
      id: "wp1",
      postId: "post1",
      wallOwnerId: "user2",
      post: { authorId: "user1" },
      wallOwner: { username: "wallowner" },
    } as never);
    mockPrisma.post.delete.mockResolvedValueOnce({} as never);

    const result = await deleteWallPost(
      prevState,
      makeFormData({ wallPostId: "wp1" })
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.post.delete).toHaveBeenCalledWith({
      where: { id: "post1" },
    });
  });

  it("allows wall owner to delete wall post", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user2" } } as never);
    mockPrisma.wallPost.findUnique.mockResolvedValueOnce({
      id: "wp1",
      postId: "post1",
      wallOwnerId: "user2",
      post: { authorId: "user1" },
      wallOwner: { username: "wallowner" },
    } as never);
    mockPrisma.post.delete.mockResolvedValueOnce({} as never);

    const result = await deleteWallPost(
      prevState,
      makeFormData({ wallPostId: "wp1" })
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.post.delete).toHaveBeenCalledWith({
      where: { id: "post1" },
    });
  });
});
