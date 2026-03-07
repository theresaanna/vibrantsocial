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
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

describe("autoFriendNewUser", () => {
  beforeEach(() => vi.clearAllMocks());

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

  it("returns false and does not throw when transaction fails", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "theresa-id",
    } as never);
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("DB error"));

    const result = await autoFriendNewUser("new-user-id");

    expect(result).toBe(false);
  });
});
