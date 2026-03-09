import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteAccount } from "@/app/profile/actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    post: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
    },
    repost: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    like: { deleteMany: vi.fn() },
    bookmark: { deleteMany: vi.fn() },
    comment: { deleteMany: vi.fn() },
    postTag: { deleteMany: vi.fn() },
    postRevision: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    deletedUser: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: {
    userProfile: (username: string) => `profile:${username}`,
  },
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    send: vi.fn(),
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockInngest = vi.mocked(inngest);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };

const mockUser = {
  id: "user1",
  email: "user@example.com",
  username: "testuser",
  displayName: "Test User",
  avatar: null,
};

function setupDefaultMocks() {
  mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
  mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser as never);
  mockPrisma.post.findMany.mockResolvedValueOnce([] as never); // user posts
  mockPrisma.message.findMany.mockResolvedValueOnce([] as never); // messages
  mockPrisma.repost.findMany
    .mockResolvedValueOnce([] as never) // user reposts (for blob URLs)
    .mockResolvedValueOnce([] as never); // quoted posts check
  mockPrisma.deletedUser.create.mockResolvedValueOnce({} as never);
  mockPrisma.user.delete.mockResolvedValueOnce({} as never);
}

describe("deleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await deleteAccount(
      prevState,
      makeFormData({ confirmation: "delete testuser" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if user not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await deleteAccount(
      prevState,
      makeFormData({ confirmation: "delete testuser" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("User not found or username not set");
  });

  it("returns error if user has no username", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      username: null,
    } as never);

    const result = await deleteAccount(
      prevState,
      makeFormData({ confirmation: "delete testuser" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("User not found or username not set");
  });

  it("returns error if confirmation text does not match", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser as never);

    const result = await deleteAccount(
      prevState,
      makeFormData({ confirmation: "wrong text" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Confirmation text does not match");
  });

  it("returns error if confirmation text is empty", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser as never);

    const result = await deleteAccount(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Confirmation text does not match");
  });

  it("accepts case-insensitive confirmation", async () => {
    setupDefaultMocks();
    // Override user findUnique to return the user again
    vi.mocked(mockPrisma.user.findUnique).mockReset();
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser as never);
    mockPrisma.post.findMany.mockReset();
    mockPrisma.post.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.message.findMany.mockReset();
    mockPrisma.message.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.repost.findMany.mockReset();
    mockPrisma.repost.findMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    mockPrisma.deletedUser.create.mockReset();
    mockPrisma.deletedUser.create.mockResolvedValueOnce({} as never);
    mockPrisma.user.delete.mockReset();
    mockPrisma.user.delete.mockResolvedValueOnce({} as never);

    const result = await deleteAccount(
      prevState,
      makeFormData({ confirmation: "DELETE TESTUSER" })
    );
    expect(result.success).toBe(true);
  });

  it("deletes user and creates DeletedUser record", async () => {
    setupDefaultMocks();

    const result = await deleteAccount(
      prevState,
      makeFormData({ confirmation: "delete testuser" })
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe("Account deleted");
    expect(mockPrisma.deletedUser.create).toHaveBeenCalledWith({
      data: {
        originalId: "user1",
        email: "user@example.com",
        username: "testuser",
        displayName: "Test User",
      },
    });
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: "user1" },
    });
  });

  it("collects and sends blob URLs to Inngest for deletion", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      avatar: "https://abc.public.blob.vercel-storage.com/avatars/user1.jpg",
    } as never);

    // Posts with blob URLs in content
    mockPrisma.post.findMany.mockResolvedValueOnce([
      {
        id: "post1",
        content: '{"nodes":[{"src":"https://abc.public.blob.vercel-storage.com/uploads/user1-123.jpg"}]}',
      },
    ] as never);

    // Messages with media
    mockPrisma.message.findMany.mockResolvedValueOnce([
      { mediaUrl: "https://abc.public.blob.vercel-storage.com/uploads/user1-456.mp4" },
    ] as never);

    // User reposts
    mockPrisma.repost.findMany.mockResolvedValueOnce([] as never);

    // No quoted posts
    mockPrisma.repost.findMany.mockResolvedValueOnce([] as never);

    // Non-quoted post deletion
    mockPrisma.post.deleteMany.mockResolvedValueOnce({} as never);

    mockPrisma.deletedUser.create.mockResolvedValueOnce({} as never);
    mockPrisma.user.delete.mockResolvedValueOnce({} as never);

    await deleteAccount(
      prevState,
      makeFormData({ confirmation: "delete testuser" })
    );

    expect(mockInngest.send).toHaveBeenCalledWith({
      name: "user/delete-media",
      data: {
        blobUrls: expect.arrayContaining([
          "https://abc.public.blob.vercel-storage.com/avatars/user1.jpg",
          "https://abc.public.blob.vercel-storage.com/uploads/user1-123.jpg",
          "https://abc.public.blob.vercel-storage.com/uploads/user1-456.mp4",
        ]),
        originalUserId: "user1",
      },
    });
  });

  it("does not send Inngest event when no blob URLs exist", async () => {
    setupDefaultMocks();

    await deleteAccount(
      prevState,
      makeFormData({ confirmation: "delete testuser" })
    );

    expect(mockInngest.send).not.toHaveBeenCalled();
  });

  it("tombstones posts that have been quoted by other users", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser as never);

    // User has two posts
    mockPrisma.post.findMany.mockResolvedValueOnce([
      { id: "post1", content: "regular content" },
      { id: "post2", content: "quoted content" },
    ] as never);

    mockPrisma.message.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.repost.findMany.mockResolvedValueOnce([] as never); // user reposts

    // post2 has been quoted by another user
    mockPrisma.repost.findMany.mockResolvedValueOnce([
      { postId: "post2" },
    ] as never);

    // Tombstone operations
    mockPrisma.post.updateMany.mockResolvedValueOnce({} as never);
    mockPrisma.like.deleteMany.mockResolvedValueOnce({} as never);
    mockPrisma.bookmark.deleteMany.mockResolvedValueOnce({} as never);
    mockPrisma.comment.deleteMany.mockResolvedValueOnce({} as never);
    mockPrisma.postTag.deleteMany.mockResolvedValueOnce({} as never);
    mockPrisma.postRevision.deleteMany.mockResolvedValueOnce({} as never);
    mockPrisma.notification.deleteMany.mockResolvedValueOnce({} as never);
    mockPrisma.repost.deleteMany.mockResolvedValueOnce({} as never);

    // Non-quoted post deletion (only post1)
    mockPrisma.post.deleteMany.mockResolvedValueOnce({} as never);

    mockPrisma.deletedUser.create.mockResolvedValueOnce({} as never);
    mockPrisma.user.delete.mockResolvedValueOnce({} as never);

    await deleteAccount(
      prevState,
      makeFormData({ confirmation: "delete testuser" })
    );

    // Should tombstone post2
    expect(mockPrisma.post.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["post2"] } },
      data: expect.objectContaining({
        isAuthorDeleted: true,
        authorId: null,
        isSensitive: false,
        isNsfw: false,
        isGraphicNudity: false,
        isPinned: false,
      }),
    });

    // Should clean up associated data for tombstoned posts
    expect(mockPrisma.like.deleteMany).toHaveBeenCalledWith({
      where: { postId: { in: ["post2"] } },
    });
    expect(mockPrisma.comment.deleteMany).toHaveBeenCalledWith({
      where: { postId: { in: ["post2"] } },
    });

    // Should delete non-quoted posts explicitly
    expect(mockPrisma.post.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["post1"] } },
    });
  });

  it("deletes non-quoted posts explicitly when no quoted posts", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser as never);

    mockPrisma.post.findMany.mockResolvedValueOnce([
      { id: "post1", content: "content" },
      { id: "post2", content: "content" },
    ] as never);

    mockPrisma.message.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.repost.findMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never); // no quoted posts

    mockPrisma.post.deleteMany.mockResolvedValueOnce({} as never);
    mockPrisma.deletedUser.create.mockResolvedValueOnce({} as never);
    mockPrisma.user.delete.mockResolvedValueOnce({} as never);

    await deleteAccount(
      prevState,
      makeFormData({ confirmation: "delete testuser" })
    );

    // Should not tombstone any posts
    expect(mockPrisma.post.updateMany).not.toHaveBeenCalled();

    // Should delete all posts
    expect(mockPrisma.post.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["post1", "post2"] } },
    });
  });

  it("handles user with no posts or messages", async () => {
    setupDefaultMocks();

    const result = await deleteAccount(
      prevState,
      makeFormData({ confirmation: "delete testuser" })
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.post.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.post.deleteMany).not.toHaveBeenCalled();
  });
});
