import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyPostSubscribers } from "@/lib/subscription-notifications";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    postSubscription: {
      findMany: vi.fn(),
    },
    closeFriend: {
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

describe("notifyPostSubscribers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing for sensitive posts", async () => {
    await notifyPostSubscribers({
      authorId: "author1",
      postId: "post1",
      isSensitive: true,
    });

    expect(mockPrisma.postSubscription.findMany).not.toHaveBeenCalled();
  });

  it("does nothing for NSFW posts", async () => {
    await notifyPostSubscribers({
      authorId: "author1",
      postId: "post1",
      isNsfw: true,
    });

    expect(mockPrisma.postSubscription.findMany).not.toHaveBeenCalled();
  });

  it("does nothing for graphic nudity posts", async () => {
    await notifyPostSubscribers({
      authorId: "author1",
      postId: "post1",
      isGraphicNudity: true,
    });

    expect(mockPrisma.postSubscription.findMany).not.toHaveBeenCalled();
  });

  it("does nothing when there are no subscribers", async () => {
    mockPrisma.postSubscription.findMany.mockResolvedValueOnce([] as never);

    await notifyPostSubscribers({
      authorId: "author1",
      postId: "post1",
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("sends notifications to all subscribers for a regular post", async () => {
    mockPrisma.postSubscription.findMany.mockResolvedValueOnce([
      { subscriberId: "sub1" },
      { subscriberId: "sub2" },
    ] as never);

    // For email notifications
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { email: "sub1@test.com" },
    ] as never);

    // For author name
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      displayName: "Author",
      username: "author1",
      name: null,
    } as never);

    mockCreateNotification.mockResolvedValue({} as never);
    mockInngest.send.mockResolvedValue({} as never);

    await notifyPostSubscribers({
      authorId: "author1",
      postId: "post1",
    });

    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "NEW_POST",
      actorId: "author1",
      targetUserId: "sub1",
      postId: "post1",
    });
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "NEW_POST",
      actorId: "author1",
      targetUserId: "sub2",
      postId: "post1",
    });
  });

  it("sends email notifications to subscribers with email preference enabled", async () => {
    mockPrisma.postSubscription.findMany.mockResolvedValueOnce([
      { subscriberId: "sub1" },
    ] as never);

    mockPrisma.user.findMany.mockResolvedValueOnce([
      { email: "sub1@test.com" },
    ] as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      displayName: "Author",
      username: "author1",
      name: null,
    } as never);

    mockCreateNotification.mockResolvedValue({} as never);
    mockInngest.send.mockResolvedValue({} as never);

    await notifyPostSubscribers({
      authorId: "author1",
      postId: "post1",
    });

    expect(mockInngest.send).toHaveBeenCalledWith({
      name: "email/new-post",
      data: {
        toEmail: "sub1@test.com",
        authorName: "Author",
        postId: "post1",
      },
    });
  });

  it("filters subscribers for close-friends-only posts", async () => {
    mockPrisma.postSubscription.findMany.mockResolvedValueOnce([
      { subscriberId: "sub1" },
      { subscriberId: "sub2" },
      { subscriberId: "sub3" },
    ] as never);

    // Only sub1 and sub3 are on the author's close friends list
    mockPrisma.closeFriend.findMany.mockResolvedValueOnce([
      { friendId: "sub1" },
      { friendId: "sub3" },
    ] as never);

    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      displayName: "Author",
      username: "author1",
      name: null,
    } as never);

    mockCreateNotification.mockResolvedValue({} as never);

    await notifyPostSubscribers({
      authorId: "author1",
      postId: "post1",
      isCloseFriendsOnly: true,
    });

    // Only sub1 and sub3 should receive notifications (not sub2)
    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ targetUserId: "sub1" })
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ targetUserId: "sub3" })
    );
    expect(mockCreateNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ targetUserId: "sub2" })
    );
  });

  it("does not send emails when no subscribers have email enabled", async () => {
    mockPrisma.postSubscription.findMany.mockResolvedValueOnce([
      { subscriberId: "sub1" },
    ] as never);

    // No subscribers with email preference
    mockPrisma.user.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      displayName: "Author",
      username: "author1",
      name: null,
    } as never);

    mockCreateNotification.mockResolvedValue({} as never);

    await notifyPostSubscribers({
      authorId: "author1",
      postId: "post1",
    });

    expect(mockInngest.send).not.toHaveBeenCalled();
  });

  it("uses username as fallback when displayName is null", async () => {
    mockPrisma.postSubscription.findMany.mockResolvedValueOnce([
      { subscriberId: "sub1" },
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

    await notifyPostSubscribers({
      authorId: "author1",
      postId: "post1",
    });

    expect(mockInngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorName: "cooluser" }),
      })
    );
  });

  it("skips close-friends-only filtering when all subscribers are filtered out", async () => {
    mockPrisma.postSubscription.findMany.mockResolvedValueOnce([
      { subscriberId: "sub1" },
    ] as never);

    // sub1 is NOT on close friends list
    mockPrisma.closeFriend.findMany.mockResolvedValueOnce([] as never);

    await notifyPostSubscribers({
      authorId: "author1",
      postId: "post1",
      isCloseFriendsOnly: true,
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});
