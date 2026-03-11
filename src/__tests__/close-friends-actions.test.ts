import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addCloseFriend,
  removeCloseFriend,
  getCloseFriends,
  getCloseFriendIds,
  isCloseFriend,
  getAcceptedFriends,
} from "@/app/feed/close-friends-actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    closeFriend: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    friendRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

const prevState = { success: false, message: "" };

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

describe("addCloseFriend", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await addCloseFriend(prevState, makeFormData({ friendId: "u2" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if friendId is missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await addCloseFriend(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Friend ID required");
  });

  it("prevents adding yourself", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await addCloseFriend(prevState, makeFormData({ friendId: "user1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Cannot add yourself");
  });

  it("requires an accepted friendship", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce(null as never);

    const result = await addCloseFriend(prevState, makeFormData({ friendId: "user2" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("You must be friends first");
  });

  it("returns error if already on close friends list", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce({
      id: "fr1",
      senderId: "user1",
      receiverId: "user2",
      status: "ACCEPTED",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    mockPrisma.closeFriend.findUnique.mockResolvedValueOnce({
      id: "cf1",
      userId: "user1",
      friendId: "user2",
      createdAt: new Date(),
    } as never);

    const result = await addCloseFriend(prevState, makeFormData({ friendId: "user2" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Already on your close friends list");
  });

  it("creates close friend entry on success", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce({
      id: "fr1",
      senderId: "user1",
      receiverId: "user2",
      status: "ACCEPTED",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    mockPrisma.closeFriend.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.closeFriend.create.mockResolvedValueOnce({} as never);

    const result = await addCloseFriend(prevState, makeFormData({ friendId: "user2" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Added to close friends");
    expect(mockPrisma.closeFriend.create).toHaveBeenCalledWith({
      data: { userId: "user1", friendId: "user2" },
    });
  });
});

describe("removeCloseFriend", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await removeCloseFriend(prevState, makeFormData({ friendId: "u2" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if not on list", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.closeFriend.findUnique.mockResolvedValueOnce(null as never);

    const result = await removeCloseFriend(prevState, makeFormData({ friendId: "user2" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not on your close friends list");
  });

  it("deletes close friend entry on success", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.closeFriend.findUnique.mockResolvedValueOnce({
      id: "cf1",
      userId: "user1",
      friendId: "user2",
      createdAt: new Date(),
    } as never);
    mockPrisma.closeFriend.delete.mockResolvedValueOnce({} as never);

    const result = await removeCloseFriend(prevState, makeFormData({ friendId: "user2" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Removed from close friends");
    expect(mockPrisma.closeFriend.delete).toHaveBeenCalledWith({
      where: { id: "cf1" },
    });
  });
});

describe("getCloseFriends", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await getCloseFriends();
    expect(result).toEqual([]);
  });

  it("returns close friends list", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const mockFriends = [
      {
        id: "cf1",
        userId: "user1",
        friendId: "user2",
        createdAt: new Date(),
        friend: { id: "user2", username: "alice", displayName: "Alice", name: null, avatar: null, image: null },
      },
    ];
    mockPrisma.closeFriend.findMany.mockResolvedValueOnce(mockFriends as never);

    const result = await getCloseFriends();
    expect(result).toEqual(mockFriends);
    expect(mockPrisma.closeFriend.findMany).toHaveBeenCalledWith({
      where: { userId: "user1" },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            displayName: true,
            name: true,
            avatar: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("getCloseFriendIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns friend IDs", async () => {
    mockPrisma.closeFriend.findMany.mockResolvedValueOnce([
      { friendId: "user2" },
      { friendId: "user3" },
    ] as never);

    const result = await getCloseFriendIds("user1");
    expect(result).toEqual(["user2", "user3"]);
  });
});

describe("isCloseFriend", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when record exists", async () => {
    mockPrisma.closeFriend.findUnique.mockResolvedValueOnce({
      id: "cf1",
      userId: "user1",
      friendId: "user2",
      createdAt: new Date(),
    } as never);

    const result = await isCloseFriend("user1", "user2");
    expect(result).toBe(true);
  });

  it("returns false when no record", async () => {
    mockPrisma.closeFriend.findUnique.mockResolvedValueOnce(null as never);

    const result = await isCloseFriend("user1", "user2");
    expect(result).toBe(false);
  });
});

describe("getAcceptedFriends", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await getAcceptedFriends();
    expect(result).toEqual([]);
  });

  it("returns the other user in each friendship", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const mockFriendships = [
      {
        id: "fr1",
        senderId: "user1",
        receiverId: "user2",
        status: "ACCEPTED",
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: { id: "user1", username: "me", displayName: "Me", name: null, avatar: null, image: null },
        receiver: { id: "user2", username: "alice", displayName: "Alice", name: null, avatar: null, image: null },
      },
      {
        id: "fr2",
        senderId: "user3",
        receiverId: "user1",
        status: "ACCEPTED",
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: { id: "user3", username: "bob", displayName: "Bob", name: null, avatar: null, image: null },
        receiver: { id: "user1", username: "me", displayName: "Me", name: null, avatar: null, image: null },
      },
    ];
    mockPrisma.friendRequest.findMany.mockResolvedValueOnce(mockFriendships as never);

    const result = await getAcceptedFriends();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("user2"); // receiver when user1 is sender
    expect(result[1].id).toBe("user3"); // sender when user1 is receiver
  });
});
