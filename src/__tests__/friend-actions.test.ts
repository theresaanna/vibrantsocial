import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getFriendshipStatus,
} from "@/app/feed/friend-actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    friendRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    follow: {
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: {
    userFollowing: (id: string) => `user:${id}:following`,
    userProfile: (username: string) => `profile:${username}`,
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

const mockAblyPublish = vi.fn();
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

describe("sendFriendRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await sendFriendRequest(prevState, makeFormData({ userId: "u2" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("prevents friending yourself", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await sendFriendRequest(prevState, makeFormData({ userId: "user1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Cannot friend yourself");
  });

  it("returns error if request already exists", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce({
      id: "fr1",
      senderId: "user1",
      receiverId: "user2",
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await sendFriendRequest(prevState, makeFormData({ userId: "user2" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Friend request already pending");
  });

  it("returns error if already friends", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce({
      id: "fr1",
      senderId: "user1",
      receiverId: "user2",
      status: "ACCEPTED",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await sendFriendRequest(prevState, makeFormData({ userId: "user2" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Already friends");
  });

  it("creates request and sends notification on success", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce(null as never);
    mockPrisma.friendRequest.create.mockResolvedValueOnce({} as never);
    (mockPrisma.follow.upsert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({} as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "sender" } as never)
      .mockResolvedValueOnce({ username: "receiver" } as never);

    const result = await sendFriendRequest(prevState, makeFormData({ userId: "user2" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Friend request sent");
    expect(mockPrisma.friendRequest.create).toHaveBeenCalledWith({
      data: { senderId: "user1", receiverId: "user2" },
    });
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "FRIEND_REQUEST",
      actorId: "user1",
      targetUserId: "user2",
    });
  });

  it("auto-follows target user when sending friend request", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce(null as never);
    mockPrisma.friendRequest.create.mockResolvedValueOnce({} as never);
    (mockPrisma.follow.upsert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({} as never);
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ username: "sender" } as never)
      .mockResolvedValueOnce({ username: "receiver" } as never);

    const result = await sendFriendRequest(prevState, makeFormData({ userId: "user2" }));
    expect(result.success).toBe(true);
    expect(mockPrisma.follow.upsert).toHaveBeenCalledWith({
      where: {
        followerId_followingId: {
          followerId: "user1",
          followingId: "user2",
        },
      },
      create: { followerId: "user1", followingId: "user2" },
      update: {},
    });
  });

  it("still succeeds even if auto-follow fails", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce(null as never);
    mockPrisma.friendRequest.create.mockResolvedValueOnce({} as never);
    (mockPrisma.follow.upsert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB error"));

    const result = await sendFriendRequest(prevState, makeFormData({ userId: "user2" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Friend request sent");
  });
});

describe("acceptFriendRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await acceptFriendRequest(prevState, makeFormData({ requestId: "r1" }));
    expect(result.success).toBe(false);
  });

  it("returns error if request not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user2" } } as never);
    mockPrisma.friendRequest.findUnique.mockResolvedValueOnce(null as never);

    const result = await acceptFriendRequest(prevState, makeFormData({ requestId: "r1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Request not found");
  });

  it("returns error if not the receiver", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user3" } } as never);
    mockPrisma.friendRequest.findUnique.mockResolvedValueOnce({
      id: "r1",
      senderId: "user1",
      receiverId: "user2",
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await acceptFriendRequest(prevState, makeFormData({ requestId: "r1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not your request");
  });

  it("returns error if not pending", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user2" } } as never);
    mockPrisma.friendRequest.findUnique.mockResolvedValueOnce({
      id: "r1",
      senderId: "user1",
      receiverId: "user2",
      status: "ACCEPTED",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await acceptFriendRequest(prevState, makeFormData({ requestId: "r1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Request already handled");
  });

  it("updates to ACCEPTED and notifies sender", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user2" } } as never);
    mockPrisma.friendRequest.findUnique.mockResolvedValueOnce({
      id: "r1",
      senderId: "user1",
      receiverId: "user2",
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    mockPrisma.friendRequest.update.mockResolvedValueOnce({} as never);

    const result = await acceptFriendRequest(prevState, makeFormData({ requestId: "r1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Friend request accepted");
    expect(mockPrisma.friendRequest.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { status: "ACCEPTED" },
    });
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "FRIEND_REQUEST",
      actorId: "user2",
      targetUserId: "user1",
    });
  });
});

describe("declineFriendRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await declineFriendRequest(prevState, makeFormData({ requestId: "r1" }));
    expect(result.success).toBe(false);
  });

  it("returns error if not the receiver", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user3" } } as never);
    mockPrisma.friendRequest.findUnique.mockResolvedValueOnce({
      id: "r1",
      senderId: "user1",
      receiverId: "user2",
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await declineFriendRequest(prevState, makeFormData({ requestId: "r1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not your request");
  });

  it("deletes the record so sender can re-request", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user2" } } as never);
    mockPrisma.friendRequest.findUnique.mockResolvedValueOnce({
      id: "r1",
      senderId: "user1",
      receiverId: "user2",
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    mockPrisma.friendRequest.delete.mockResolvedValueOnce({} as never);

    const result = await declineFriendRequest(prevState, makeFormData({ requestId: "r1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Friend request declined");
    expect(mockPrisma.friendRequest.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
  });
});

describe("removeFriend", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await removeFriend(prevState, makeFormData({ userId: "u2" }));
    expect(result.success).toBe(false);
  });

  it("returns error if not friends", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce(null as never);

    const result = await removeFriend(prevState, makeFormData({ userId: "user2" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not friends");
  });

  it("deletes friendship record", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce({
      id: "fr1",
      senderId: "user1",
      receiverId: "user2",
      status: "ACCEPTED",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    mockPrisma.friendRequest.delete.mockResolvedValueOnce({} as never);

    const result = await removeFriend(prevState, makeFormData({ userId: "user2" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Friend removed");
    expect(mockPrisma.friendRequest.delete).toHaveBeenCalledWith({ where: { id: "fr1" } });
  });
});

describe("getFriendshipStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns none when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await getFriendshipStatus("user2");
    expect(result.status).toBe("none");
  });

  it("returns none when no request exists", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce(null as never);

    const result = await getFriendshipStatus("user2");
    expect(result.status).toBe("none");
  });

  it("returns pending_sent when current user sent request", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce({
      id: "fr1",
      senderId: "user1",
      status: "PENDING",
    } as never);

    const result = await getFriendshipStatus("user2");
    expect(result.status).toBe("pending_sent");
    expect(result.requestId).toBe("fr1");
  });

  it("returns pending_received when current user received request", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user2" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce({
      id: "fr1",
      senderId: "user1",
      status: "PENDING",
    } as never);

    const result = await getFriendshipStatus("user1");
    expect(result.status).toBe("pending_received");
    expect(result.requestId).toBe("fr1");
  });

  it("returns friends when accepted request exists", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce({
      id: "fr1",
      senderId: "user1",
      status: "ACCEPTED",
    } as never);

    const result = await getFriendshipStatus("user2");
    expect(result.status).toBe("friends");
    expect(result.requestId).toBe("fr1");
  });
});
