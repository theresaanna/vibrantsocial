import { describe, it, expect, vi, beforeEach } from "vitest";
import { autoFriendNewUser } from "@/lib/auto-friend";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    follow: {
      create: vi.fn(),
    },
    friendRequest: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

describe("autoFriendNewUser", () => {
  beforeEach(() => vi.clearAllMocks());

  // ---- Success path ----

  it("creates mutual follows with the default user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "theresa-id",
    } as never);
    mockPrisma.$transaction.mockResolvedValueOnce(undefined as never);

    const result = await autoFriendNewUser("new-user-id");

    expect(result).toBe(true);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { username: "theresa" },
      select: { id: true },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("returns true on successful transaction", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "theresa-id",
    } as never);
    mockPrisma.$transaction.mockResolvedValueOnce(undefined as never);

    const result = await autoFriendNewUser("new-user-id");
    expect(result).toBe(true);
  });

  // ---- Transaction contents ----

  it("creates follow from new user to default user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "theresa-id",
    } as never);
    mockPrisma.$transaction.mockResolvedValueOnce(undefined as never);

    await autoFriendNewUser("new-user-id");

    const transactionArg = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
    expect(transactionArg).toHaveLength(3);
  });

  it("passes the correct operations in the transaction", async () => {
    // Verify follow.create and friendRequest.create are called with right data
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "theresa-id",
    } as never);
    mockPrisma.$transaction.mockResolvedValueOnce(undefined as never);

    // The module calls prisma.follow.create and prisma.friendRequest.create
    // which return Promise objects passed to $transaction
    await autoFriendNewUser("new-user-id");

    expect(mockPrisma.follow.create).toHaveBeenCalledWith({
      data: { followerId: "new-user-id", followingId: "theresa-id" },
    });
    expect(mockPrisma.follow.create).toHaveBeenCalledWith({
      data: { followerId: "theresa-id", followingId: "new-user-id" },
    });
    expect(mockPrisma.friendRequest.create).toHaveBeenCalledWith({
      data: {
        senderId: "theresa-id",
        receiverId: "new-user-id",
        status: "ACCEPTED",
      },
    });
  });

  it("creates an already-ACCEPTED friend request", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "theresa-id",
    } as never);
    mockPrisma.$transaction.mockResolvedValueOnce(undefined as never);

    await autoFriendNewUser("new-user-id");

    expect(mockPrisma.friendRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACCEPTED" }),
      })
    );
  });

  // ---- Early returns ----

  it("returns false when default user is not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await autoFriendNewUser("new-user-id");

    expect(result).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns false when new user is the default user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "theresa-id",
    } as never);

    const result = await autoFriendNewUser("theresa-id");

    expect(result).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  // ---- Error handling ----

  it("returns false and does not throw when transaction fails", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "theresa-id",
    } as never);
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("DB error"));

    const result = await autoFriendNewUser("new-user-id");

    expect(result).toBe(false);
  });

  it("returns false when user lookup throws", async () => {
    mockPrisma.user.findUnique.mockRejectedValueOnce(new Error("Connection lost"));

    const result = await autoFriendNewUser("new-user-id");

    expect(result).toBe(false);
  });

  it("never throws regardless of error type", async () => {
    mockPrisma.user.findUnique.mockRejectedValueOnce(new TypeError("unexpected"));

    // Should not throw
    const result = await autoFriendNewUser("new-user-id");
    expect(result).toBe(false);
  });

  // ---- Lookup specifics ----

  it("always looks up the 'theresa' username", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    await autoFriendNewUser("any-user-id");

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { username: "theresa" },
      select: { id: true },
    });
  });
});
