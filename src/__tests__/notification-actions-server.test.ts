import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotifications,
  getRecentNotifications,
  getUnreadNotificationCount,
} from "@/app/notifications/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

describe("notification server actions", () => {
  beforeEach(() => vi.clearAllMocks());

  /* ── getNotifications ───────────────────────────────── */

  describe("getNotifications", () => {
    it("returns empty array when not authenticated", async () => {
      mockAuth.mockResolvedValueOnce(null as never);
      const result = await getNotifications();
      expect(result).toEqual([]);
    });

    it("returns empty array when session has no user id", async () => {
      mockAuth.mockResolvedValueOnce({ user: {} } as never);
      const result = await getNotifications();
      expect(result).toEqual([]);
    });

    it("fetches notifications with proper includes", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      const notifications = [
        {
          id: "n1",
          type: "LIKE",
          actorId: "a1",
          createdAt: new Date(),
          actor: { id: "a1", username: "alice", displayName: "Alice", name: null, image: null, avatar: null, profileFrameId: null },
          post: { id: "p1", content: "content" },
          message: null,
          tag: null,
        },
      ];
      mockPrisma.notification.findMany.mockResolvedValueOnce(notifications as never);

      const result = await getNotifications();
      expect(result).toEqual(notifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { targetUserId: "u1" },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          actor: {
            select: { id: true, username: true, displayName: true, name: true, image: true, avatar: true, profileFrameId: true, usernameFont: true },
          },
          post: { select: { id: true, content: true } },
          message: { select: { id: true, conversationId: true } },
          tag: { select: { id: true, name: true } },
        },
      });
    });
  });

  /* ── markNotificationRead ───────────────────────────── */

  describe("markNotificationRead", () => {
    it("returns error when not authenticated", async () => {
      mockAuth.mockResolvedValueOnce(null as never);
      const result = await markNotificationRead("n1");
      expect(result.success).toBe(false);
      expect(result.message).toBe("Not authenticated");
    });

    it("marks specific notification as read", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.notification.updateMany.mockResolvedValueOnce({ count: 1 } as never);

      const result = await markNotificationRead("n1");
      expect(result.success).toBe(true);
      expect(result.message).toBe("Marked as read");
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: "n1", targetUserId: "u1" },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  /* ── markAllNotificationsRead ───────────────────────── */

  describe("markAllNotificationsRead", () => {
    it("returns error when not authenticated", async () => {
      mockAuth.mockResolvedValueOnce(null as never);
      const result = await markAllNotificationsRead();
      expect(result.success).toBe(false);
      expect(result.message).toBe("Not authenticated");
    });

    it("marks all unread notifications as read", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.notification.updateMany.mockResolvedValueOnce({ count: 3 } as never);

      const result = await markAllNotificationsRead();
      expect(result.success).toBe(true);
      expect(result.message).toBe("All marked as read");
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { targetUserId: "u1", readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  /* ── deleteNotifications ───────────────────────────── */

  describe("deleteNotifications", () => {
    it("returns error when not authenticated", async () => {
      mockAuth.mockResolvedValueOnce(null as never);
      const result = await deleteNotifications(["n1"]);
      expect(result.success).toBe(false);
      expect(result.message).toBe("Not authenticated");
      expect(result.deletedCount).toBe(0);
    });

    it("returns early for empty ids array", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      const result = await deleteNotifications([]);
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(mockPrisma.notification.deleteMany).not.toHaveBeenCalled();
    });

    it("deletes notifications scoped to current user", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.notification.deleteMany.mockResolvedValueOnce({ count: 2 } as never);

      const result = await deleteNotifications(["n1", "n2"]);
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["n1", "n2"] }, targetUserId: "u1" },
      });
    });
  });

  /* ── getRecentNotifications ─────────────────────────── */

  describe("getRecentNotifications", () => {
    it("returns empty array when not authenticated", async () => {
      mockAuth.mockResolvedValueOnce(null as never);
      const result = await getRecentNotifications();
      expect(result).toEqual([]);
    });

    it("returns serialized recent notifications (take 8)", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      const now = new Date("2024-01-01T00:00:00.000Z");
      const notifications = [
        {
          id: "n1",
          type: "COMMENT",
          createdAt: now,
          actor: { id: "a1", username: "bob", displayName: "Bob", name: null, image: null, avatar: null, profileFrameId: null },
          post: { id: "p1", content: "test" },
          message: null,
          tag: null,
        },
      ];
      mockPrisma.notification.findMany.mockResolvedValueOnce(notifications as never);

      const result = await getRecentNotifications();
      // Should be JSON-serialized (dates become strings)
      expect(result).toEqual(JSON.parse(JSON.stringify(notifications)));
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { targetUserId: "u1" },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          actor: {
            select: { id: true, username: true, displayName: true, name: true, image: true, avatar: true, profileFrameId: true, usernameFont: true },
          },
          post: { select: { id: true, content: true } },
          message: { select: { id: true, conversationId: true } },
          tag: { select: { id: true, name: true } },
        },
      });
    });
  });

  /* ── getUnreadNotificationCount ─────────────────────── */

  describe("getUnreadNotificationCount", () => {
    it("returns 0 when not authenticated", async () => {
      mockAuth.mockResolvedValueOnce(null as never);
      const result = await getUnreadNotificationCount();
      expect(result).toBe(0);
    });

    it("returns unread count", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.notification.count.mockResolvedValueOnce(12 as never);

      const result = await getUnreadNotificationCount();
      expect(result).toBe(12);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { targetUserId: "u1", readAt: null },
      });
    });
  });
});
