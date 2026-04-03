import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

const mockNotificationFindMany = vi.fn();
const mockNotificationUpdateMany = vi.fn();
const mockNotificationCount = vi.fn();
const mockFriendRequestFindMany = vi.fn();
const mockMessageRequestFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: (...args: unknown[]) => mockNotificationFindMany(...args),
      updateMany: (...args: unknown[]) => mockNotificationUpdateMany(...args),
      count: (...args: unknown[]) => mockNotificationCount(...args),
    },
    friendRequest: {
      findMany: (...args: unknown[]) => mockFriendRequestFindMany(...args),
    },
    messageRequest: {
      findMany: (...args: unknown[]) => mockMessageRequestFindMany(...args),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(),
  invalidateMany: vi.fn(),
  cacheKeys: {
    userNotifications: (id: string) => `user:${id}:notifications`,
    userRecentNotifications: (id: string) => `user:${id}:recent-notifications`,
    unreadNotificationCount: (id: string) => `user:${id}:unread-count`,
    linkedAccountNotifCounts: (id: string) => `user:${id}:linked-notifs`,
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: {},
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

const mockGetAllBlockRelatedIds = vi.fn();
vi.mock("@/app/feed/block-actions", () => ({
  getAllBlockRelatedIds: (...args: unknown[]) => mockGetAllBlockRelatedIds(...args),
}));

describe("Notification block filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("getNotifications", () => {
    it("returns empty array when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const { getNotifications } = await import("@/app/notifications/actions");
      const result = await getNotifications();

      expect(result).toEqual([]);
      expect(mockGetAllBlockRelatedIds).not.toHaveBeenCalled();
    });

    it("excludes notifications from blocked users", async () => {
      mockAuth.mockResolvedValue({ user: { id: "me" } });
      mockGetAllBlockRelatedIds.mockResolvedValue(["blocked1", "blocked2"]);
      mockNotificationFindMany.mockResolvedValue([]);
      mockFriendRequestFindMany.mockResolvedValue([]);
      mockMessageRequestFindMany.mockResolvedValue([]);

      const { getNotifications } = await import("@/app/notifications/actions");
      await getNotifications();

      const query = mockNotificationFindMany.mock.calls[0][0];
      expect(query.where.actorId).toEqual({ notIn: ["blocked1", "blocked2"] });
    });

    it("does not apply actorId filter when no blocks exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "me" } });
      mockGetAllBlockRelatedIds.mockResolvedValue([]);
      mockNotificationFindMany.mockResolvedValue([]);
      mockFriendRequestFindMany.mockResolvedValue([]);
      mockMessageRequestFindMany.mockResolvedValue([]);

      const { getNotifications } = await import("@/app/notifications/actions");
      await getNotifications();

      const query = mockNotificationFindMany.mock.calls[0][0];
      expect(query.where.actorId).toBeUndefined();
    });

    it("still filters by targetUserId alongside block filter", async () => {
      mockAuth.mockResolvedValue({ user: { id: "me" } });
      mockGetAllBlockRelatedIds.mockResolvedValue(["blocked1"]);
      mockNotificationFindMany.mockResolvedValue([]);
      mockFriendRequestFindMany.mockResolvedValue([]);
      mockMessageRequestFindMany.mockResolvedValue([]);

      const { getNotifications } = await import("@/app/notifications/actions");
      await getNotifications();

      const query = mockNotificationFindMany.mock.calls[0][0];
      expect(query.where.targetUserId).toBe("me");
      expect(query.where.actorId).toEqual({ notIn: ["blocked1"] });
    });

    it("calls getAllBlockRelatedIds with the current user id", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-789" } });
      mockGetAllBlockRelatedIds.mockResolvedValue([]);
      mockNotificationFindMany.mockResolvedValue([]);
      mockFriendRequestFindMany.mockResolvedValue([]);
      mockMessageRequestFindMany.mockResolvedValue([]);

      const { getNotifications } = await import("@/app/notifications/actions");
      await getNotifications();

      expect(mockGetAllBlockRelatedIds).toHaveBeenCalledWith("user-789");
    });

    it("returns notifications only from non-blocked users", async () => {
      mockAuth.mockResolvedValue({ user: { id: "me" } });
      mockGetAllBlockRelatedIds.mockResolvedValue(["blocked1"]);

      const notifications = [
        {
          id: "n1",
          type: "LIKE",
          actorId: "good-user",
          targetUserId: "me",
          createdAt: new Date(),
          actor: { id: "good-user", username: "gooduser" },
          post: null,
          message: null,
          tag: null,
          userList: null,
        },
      ];
      mockNotificationFindMany.mockResolvedValue(notifications);
      mockFriendRequestFindMany.mockResolvedValue([]);
      mockMessageRequestFindMany.mockResolvedValue([]);

      const { getNotifications } = await import("@/app/notifications/actions");
      const result = await getNotifications();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("n1");
    });

    it("enriches friend request notifications with pending status", async () => {
      mockAuth.mockResolvedValue({ user: { id: "me" } });
      mockGetAllBlockRelatedIds.mockResolvedValue([]);

      const notifications = [
        {
          id: "n1",
          type: "FRIEND_REQUEST",
          actorId: "friend-user",
          targetUserId: "me",
          createdAt: new Date(),
          actor: { id: "friend-user", username: "frienduser" },
          post: null,
          message: null,
          tag: null,
          userList: null,
        },
      ];
      mockNotificationFindMany.mockResolvedValue(notifications);
      mockFriendRequestFindMany.mockResolvedValue([{ senderId: "friend-user" }]);
      mockMessageRequestFindMany.mockResolvedValue([]);

      const { getNotifications } = await import("@/app/notifications/actions");
      const result = await getNotifications();

      expect(result[0].hasPendingFriendRequest).toBe(true);
    });
  });

  describe("getRecentNotifications", () => {
    it("returns empty array when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const { getRecentNotifications } = await import("@/app/notifications/actions");
      const result = await getRecentNotifications();

      expect(result).toEqual([]);
      expect(mockGetAllBlockRelatedIds).not.toHaveBeenCalled();
    });

    it("excludes notifications from blocked users", async () => {
      mockAuth.mockResolvedValue({ user: { id: "me" } });
      mockGetAllBlockRelatedIds.mockResolvedValue(["blocked-a"]);
      mockNotificationFindMany.mockResolvedValue([]);
      mockFriendRequestFindMany.mockResolvedValue([]);
      mockMessageRequestFindMany.mockResolvedValue([]);

      const { getRecentNotifications } = await import("@/app/notifications/actions");
      await getRecentNotifications();

      const query = mockNotificationFindMany.mock.calls[0][0];
      expect(query.where.actorId).toEqual({ notIn: ["blocked-a"] });
      expect(query.take).toBe(8);
    });

    it("does not apply actorId filter when no blocks exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "me" } });
      mockGetAllBlockRelatedIds.mockResolvedValue([]);
      mockNotificationFindMany.mockResolvedValue([]);
      mockFriendRequestFindMany.mockResolvedValue([]);
      mockMessageRequestFindMany.mockResolvedValue([]);

      const { getRecentNotifications } = await import("@/app/notifications/actions");
      await getRecentNotifications();

      const query = mockNotificationFindMany.mock.calls[0][0];
      expect(query.where.actorId).toBeUndefined();
    });

    it("filters both directions of block relationships", async () => {
      mockAuth.mockResolvedValue({ user: { id: "me" } });
      // "blocked-by-me" is someone I blocked, "blocker" is someone who blocked me
      mockGetAllBlockRelatedIds.mockResolvedValue(["blocked-by-me", "blocker"]);
      mockNotificationFindMany.mockResolvedValue([]);
      mockFriendRequestFindMany.mockResolvedValue([]);
      mockMessageRequestFindMany.mockResolvedValue([]);

      const { getRecentNotifications } = await import("@/app/notifications/actions");
      await getRecentNotifications();

      const query = mockNotificationFindMany.mock.calls[0][0];
      expect(query.where.actorId.notIn).toContain("blocked-by-me");
      expect(query.where.actorId.notIn).toContain("blocker");
    });
  });
});
