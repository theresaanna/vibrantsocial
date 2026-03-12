import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyTagSubscribers } from "@/lib/tag-subscription-notifications";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tagSubscription: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    send: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { inngest } from "@/lib/inngest";

const mockPrisma = vi.mocked(prisma);
const mockCreateNotification = vi.mocked(createNotification);
const mockInngest = vi.mocked(inngest);

describe("notifyTagSubscribers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing for sensitive posts", async () => {
    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1"],
      tagNames: ["art"],
      isSensitive: true,
    });

    expect(mockPrisma.tagSubscription.findMany).not.toHaveBeenCalled();
  });

  it("does nothing for graphic nudity posts", async () => {
    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1"],
      tagNames: ["art"],
      isGraphicNudity: true,
    });

    expect(mockPrisma.tagSubscription.findMany).not.toHaveBeenCalled();
  });

  it("does nothing for close-friends-only posts", async () => {
    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1"],
      tagNames: ["art"],
      isCloseFriendsOnly: true,
    });

    expect(mockPrisma.tagSubscription.findMany).not.toHaveBeenCalled();
  });

  it("does nothing when tagIds is empty", async () => {
    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: [],
      tagNames: [],
    });

    expect(mockPrisma.tagSubscription.findMany).not.toHaveBeenCalled();
  });

  it("does nothing when there are no subscribers", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([] as never);

    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1"],
      tagNames: ["art"],
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("excludes the post author from notifications", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      { userId: "author1", tagId: "tag1", frequency: "immediate" },
    ] as never);

    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1"],
      tagNames: ["art"],
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("sends notifications to immediate subscribers for a regular post", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      { userId: "sub1", tagId: "tag1", frequency: "immediate" },
      { userId: "sub2", tagId: "tag1", frequency: "immediate" },
    ] as never);

    // Email query - no subscribers with email enabled
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);

    mockCreateNotification.mockResolvedValue({} as never);

    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1"],
      tagNames: ["art"],
    });

    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "TAG_POST",
      actorId: "author1",
      targetUserId: "sub1",
      postId: "post1",
      tagId: "tag1",
    });
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "TAG_POST",
      actorId: "author1",
      targetUserId: "sub2",
      postId: "post1",
      tagId: "tag1",
    });
  });

  it("deduplicates subscribers across multiple tags", async () => {
    // sub1 is subscribed to both tag1 and tag2
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      { userId: "sub1", tagId: "tag1", frequency: "immediate" },
      { userId: "sub1", tagId: "tag2", frequency: "immediate" },
      { userId: "sub2", tagId: "tag2", frequency: "immediate" },
    ] as never);

    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);
    mockCreateNotification.mockResolvedValue({} as never);

    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1", "tag2"],
      tagNames: ["art", "digital"],
    });

    // sub1 should only get one notification (first tag seen = tag1)
    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ targetUserId: "sub1", tagId: "tag1" })
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ targetUserId: "sub2", tagId: "tag2" })
    );
  });

  it("only notifies NSFW-opted-in subscribers for NSFW posts", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      { userId: "sub1", tagId: "tag1", frequency: "immediate" },
      { userId: "sub2", tagId: "tag1", frequency: "immediate" },
    ] as never);

    // Only sub1 has opted into NSFW
    mockPrisma.user.findMany
      .mockResolvedValueOnce([{ id: "sub1" }] as never) // NSFW opt-in filter
      .mockResolvedValueOnce([] as never); // email query

    mockCreateNotification.mockResolvedValue({} as never);

    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1"],
      tagNames: ["art"],
      isNsfw: true,
    });

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ targetUserId: "sub1" })
    );
  });

  it("skips NSFW posts when no subscribers opted in", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      { userId: "sub1", tagId: "tag1", frequency: "immediate" },
    ] as never);

    // No one opted into NSFW
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);

    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1"],
      tagNames: ["art"],
      isNsfw: true,
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("does not send in-app notifications for digest subscribers", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      { userId: "sub1", tagId: "tag1", frequency: "digest" },
    ] as never);

    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1"],
      tagNames: ["art"],
    });

    // Digest subscribers should not get immediate notifications
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("queues emails for immediate subscribers with email enabled", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      { userId: "sub1", tagId: "tag1", frequency: "immediate" },
    ] as never);

    // sub1 has email enabled
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { email: "sub1@test.com" },
    ] as never);

    // Author info
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      displayName: "Author",
      username: "author1",
      name: null,
    } as never);

    mockCreateNotification.mockResolvedValue({} as never);
    mockInngest.send.mockResolvedValue({} as never);

    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1"],
      tagNames: ["art"],
    });

    expect(mockInngest.send).toHaveBeenCalledWith({
      name: "email/tag-post",
      data: {
        toEmail: "sub1@test.com",
        authorName: "Author",
        postId: "post1",
        tagNames: ["art"],
      },
    });
  });

  it("does not queue emails for digest subscribers", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      { userId: "sub1", tagId: "tag1", frequency: "digest" },
    ] as never);

    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1"],
      tagNames: ["art"],
    });

    expect(mockInngest.send).not.toHaveBeenCalled();
  });

  it("does not queue emails when no subscribers have email preference enabled", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      { userId: "sub1", tagId: "tag1", frequency: "immediate" },
    ] as never);

    // No subscribers with email preference
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);

    mockCreateNotification.mockResolvedValue({} as never);

    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1"],
      tagNames: ["art"],
    });

    expect(mockInngest.send).not.toHaveBeenCalled();
  });

  it("uses username as fallback when displayName is null", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      { userId: "sub1", tagId: "tag1", frequency: "immediate" },
    ] as never);

    mockPrisma.user.findMany.mockResolvedValueOnce([
      { email: "sub1@test.com" },
    ] as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      displayName: null,
      username: "cooluser",
      name: null,
    } as never);

    mockCreateNotification.mockResolvedValue({} as never);
    mockInngest.send.mockResolvedValue({} as never);

    await notifyTagSubscribers({
      authorId: "author1",
      postId: "post1",
      tagIds: ["tag1"],
      tagNames: ["art"],
    });

    expect(mockInngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorName: "cooluser" }),
      })
    );
  });
});
