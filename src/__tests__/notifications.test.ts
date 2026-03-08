import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAblyPublish = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ably", () => ({
  getAblyRestClient: () => ({
    channels: {
      get: () => ({ publish: mockAblyPublish }),
    },
  }),
}));

vi.mock("@/lib/web-push", () => ({
  sendPushNotification: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

const mockPrisma = vi.mocked(prisma);

describe("createNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a notification record", async () => {
    const notification = {
      id: "n1",
      type: "LIKE" as const,
      actorId: "actor1",
      targetUserId: "target1",
      postId: "p1",
      commentId: null,
      readAt: null,
      createdAt: new Date(),
      actor: { id: "actor1", username: "alice", displayName: "Alice", name: null, image: null, avatar: null },
    };
    mockPrisma.notification.create.mockResolvedValueOnce(notification as never);
    mockPrisma.notification.count.mockResolvedValueOnce(1 as never);

    await createNotification({
      type: "LIKE",
      actorId: "actor1",
      targetUserId: "target1",
      postId: "p1",
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: {
        type: "LIKE",
        actorId: "actor1",
        targetUserId: "target1",
        postId: "p1",
        commentId: undefined,
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            displayName: true,
            name: true,
            image: true,
            avatar: true,
          },
        },
      },
    });
  });

  it("skips when actorId === targetUserId", async () => {
    await createNotification({
      type: "LIKE",
      actorId: "user1",
      targetUserId: "user1",
      postId: "p1",
    });

    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    expect(mockAblyPublish).not.toHaveBeenCalled();
  });

  it("enforces 50-record cap by deleting oldest", async () => {
    const notification = {
      id: "n51",
      type: "LIKE" as const,
      actorId: "actor1",
      targetUserId: "target1",
      postId: "p1",
      commentId: null,
      readAt: null,
      createdAt: new Date(),
      actor: { id: "actor1", username: "alice", displayName: "Alice", name: null, image: null, avatar: null },
    };
    mockPrisma.notification.create.mockResolvedValueOnce(notification as never);
    mockPrisma.notification.count.mockResolvedValueOnce(52 as never);
    mockPrisma.notification.findMany.mockResolvedValueOnce([
      { id: "old1" },
      { id: "old2" },
    ] as never);
    mockPrisma.notification.deleteMany.mockResolvedValueOnce({ count: 2 } as never);

    await createNotification({
      type: "LIKE",
      actorId: "actor1",
      targetUserId: "target1",
      postId: "p1",
    });

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
      where: { targetUserId: "target1" },
      orderBy: { createdAt: "asc" },
      take: 2,
      select: { id: true },
    });
    expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["old1", "old2"] } },
    });
  });

  it("does not delete when under 50 records", async () => {
    const notification = {
      id: "n1",
      type: "COMMENT" as const,
      actorId: "actor1",
      targetUserId: "target1",
      postId: "p1",
      commentId: "c1",
      readAt: null,
      createdAt: new Date(),
      actor: { id: "actor1", username: "alice", displayName: "Alice", name: null, image: null, avatar: null },
    };
    mockPrisma.notification.create.mockResolvedValueOnce(notification as never);
    mockPrisma.notification.count.mockResolvedValueOnce(30 as never);

    await createNotification({
      type: "COMMENT",
      actorId: "actor1",
      targetUserId: "target1",
      postId: "p1",
      commentId: "c1",
    });

    expect(mockPrisma.notification.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.notification.deleteMany).not.toHaveBeenCalled();
  });

  it("publishes to Ably notifications channel", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const notification = {
      id: "n1",
      type: "REPOST" as const,
      actorId: "actor1",
      targetUserId: "target1",
      postId: "p1",
      commentId: null,
      readAt: null,
      createdAt,
      actor: { id: "actor1", username: "bob", displayName: "Bob", name: null, image: null, avatar: null },
    };
    mockPrisma.notification.create.mockResolvedValueOnce(notification as never);
    mockPrisma.notification.count.mockResolvedValueOnce(1 as never);

    await createNotification({
      type: "REPOST",
      actorId: "actor1",
      targetUserId: "target1",
      postId: "p1",
    });

    expect(mockAblyPublish).toHaveBeenCalledWith("new", {
      id: "n1",
      type: "REPOST",
      actorId: "actor1",
      actor: JSON.stringify(notification.actor),
      postId: "p1",
      commentId: null,
      createdAt: createdAt.toISOString(),
    });
  });

  it("handles Ably failure gracefully", async () => {
    const notification = {
      id: "n1",
      type: "LIKE" as const,
      actorId: "actor1",
      targetUserId: "target1",
      postId: "p1",
      commentId: null,
      readAt: null,
      createdAt: new Date(),
      actor: { id: "actor1", username: "alice", displayName: "Alice", name: null, image: null, avatar: null },
    };
    mockPrisma.notification.create.mockResolvedValueOnce(notification as never);
    mockPrisma.notification.count.mockResolvedValueOnce(1 as never);
    mockAblyPublish.mockRejectedValueOnce(new Error("Ably down"));

    // Should not throw
    const result = await createNotification({
      type: "LIKE",
      actorId: "actor1",
      targetUserId: "target1",
      postId: "p1",
    });

    expect(result).toBeTruthy();
  });
});
