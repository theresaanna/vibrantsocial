import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
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
  getUnreadNotificationCount,
} from "@/app/notifications/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

describe("notification actions", () => {
  beforeEach(() => vi.clearAllMocks());

  /* ── getNotifications ────────────────────────────── */

  describe("getNotifications", () => {
    it("returns empty array when not authenticated", async () => {
      mockAuth.mockResolvedValueOnce(null as never);
      const result = await getNotifications();
      expect(result).toEqual([]);
    });

    it("returns ordered notifications with actor data", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      const notifications = [
        {
          id: "n1",
          type: "LIKE",
          actorId: "a1",
          createdAt: new Date(),
          actor: { id: "a1", username: "alice" },
          post: { id: "p1", content: "test" },
        },
      ];
      mockPrisma.notification.findMany.mockResolvedValueOnce(
        notifications as never
      );

      const result = await getNotifications();

      expect(result).toEqual(notifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { targetUserId: "u1" },
        orderBy: { createdAt: "desc" },
        take: 50,
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
          post: { select: { id: true, content: true } },
        },
      });
    });
  });

  /* ── markNotificationRead ────────────────────────── */

  describe("markNotificationRead", () => {
    it("rejects unauthenticated requests", async () => {
      mockAuth.mockResolvedValueOnce(null as never);
      const result = await markNotificationRead("n1");
      expect(result).toEqual({
        success: false,
        message: "Not authenticated",
      });
    });

    it("marks notification as read for the owner", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.notification.updateMany.mockResolvedValueOnce({
        count: 1,
      } as never);

      const result = await markNotificationRead("n1");

      expect(result.success).toBe(true);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: "n1", targetUserId: "u1" },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  /* ── markAllNotificationsRead ────────────────────── */

  describe("markAllNotificationsRead", () => {
    it("rejects unauthenticated requests", async () => {
      mockAuth.mockResolvedValueOnce(null as never);
      const result = await markAllNotificationsRead();
      expect(result).toEqual({
        success: false,
        message: "Not authenticated",
      });
    });

    it("marks all unread notifications as read", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.notification.updateMany.mockResolvedValueOnce({
        count: 5,
      } as never);

      const result = await markAllNotificationsRead();

      expect(result.success).toBe(true);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { targetUserId: "u1", readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  /* ── getUnreadNotificationCount ──────────────────── */

  describe("getUnreadNotificationCount", () => {
    it("returns 0 when not authenticated", async () => {
      mockAuth.mockResolvedValueOnce(null as never);
      const result = await getUnreadNotificationCount();
      expect(result).toBe(0);
    });

    it("returns the count of unread notifications", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
      mockPrisma.notification.count.mockResolvedValueOnce(7 as never);

      const result = await getUnreadNotificationCount();

      expect(result).toBe(7);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { targetUserId: "u1", readAt: null },
      });
    });
  });
});
