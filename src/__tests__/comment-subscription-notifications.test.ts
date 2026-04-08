import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyCommentSubscribers } from "@/lib/comment-subscription-notifications";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: vi.fn() },
    commentSubscription: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { send: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { inngest } from "@/lib/inngest";

const mockPrisma = vi.mocked(prisma);
const mockCreateNotification = vi.mocked(createNotification);
const mockInngest = vi.mocked(inngest);

const baseParams = {
  postId: "post1",
  commentId: "comment1",
  commentAuthorId: "commenter1",
  commenterName: "Alice",
};

describe("notifyCommentSubscribers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing when there are no subscribers", async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);
    mockPrisma.commentSubscription.findMany.mockResolvedValueOnce([] as never);

    await notifyCommentSubscribers(baseParams);

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("sends notifications to all subscribers", async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);
    mockPrisma.commentSubscription.findMany.mockResolvedValueOnce([
      { userId: "sub1" },
      { userId: "sub2" },
    ] as never);
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);
    mockCreateNotification.mockResolvedValue({} as never);

    await notifyCommentSubscribers(baseParams);

    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "SUBSCRIBED_COMMENT",
      actorId: "commenter1",
      targetUserId: "sub1",
      postId: "post1",
      commentId: "comment1",
    });
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "SUBSCRIBED_COMMENT",
      actorId: "commenter1",
      targetUserId: "sub2",
      postId: "post1",
      commentId: "comment1",
    });
  });

  it("excludes the comment author from notifications", async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);
    mockPrisma.commentSubscription.findMany.mockResolvedValueOnce([
      { userId: "commenter1" },
      { userId: "sub1" },
    ] as never);
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);
    mockCreateNotification.mockResolvedValue({} as never);

    await notifyCommentSubscribers(baseParams);

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ targetUserId: "sub1" })
    );
  });

  it("excludes the post author from notifications", async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);
    mockPrisma.commentSubscription.findMany.mockResolvedValueOnce([
      { userId: "author1" },
      { userId: "sub1" },
    ] as never);
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);
    mockCreateNotification.mockResolvedValue({} as never);

    await notifyCommentSubscribers(baseParams);

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ targetUserId: "author1" })
    );
  });

  it("does nothing when all subscribers are excluded", async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);
    mockPrisma.commentSubscription.findMany.mockResolvedValueOnce([
      { userId: "commenter1" },
      { userId: "author1" },
    ] as never);

    await notifyCommentSubscribers(baseParams);

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("sends email notifications to subscribers with the preference enabled", async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);
    mockPrisma.commentSubscription.findMany.mockResolvedValueOnce([
      { userId: "sub1" },
    ] as never);
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { email: "sub1@test.com" },
    ] as never);
    mockCreateNotification.mockResolvedValue({} as never);
    mockInngest.send.mockResolvedValue({} as never);

    await notifyCommentSubscribers(baseParams);

    expect(mockInngest.send).toHaveBeenCalledWith({
      name: "email/subscribed-comment",
      data: {
        toEmail: "sub1@test.com",
        commenterName: "Alice",
        postId: "post1",
      },
    });
  });

  it("does not send emails when no subscribers have the email preference", async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);
    mockPrisma.commentSubscription.findMany.mockResolvedValueOnce([
      { userId: "sub1" },
    ] as never);
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);
    mockCreateNotification.mockResolvedValue({} as never);

    await notifyCommentSubscribers(baseParams);

    expect(mockInngest.send).not.toHaveBeenCalled();
  });

  it("queries email subscribers with correct filters", async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ authorId: "author1" } as never);
    mockPrisma.commentSubscription.findMany.mockResolvedValueOnce([
      { userId: "sub1" },
      { userId: "sub2" },
    ] as never);
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);
    mockCreateNotification.mockResolvedValue({} as never);

    await notifyCommentSubscribers(baseParams);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["sub1", "sub2"] },
        emailOnSubscribedComment: true,
        email: { not: null },
      },
      select: { email: true },
    });
  });
});
