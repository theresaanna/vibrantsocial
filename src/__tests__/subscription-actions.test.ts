import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  togglePostSubscription,
  isSubscribedToUser,
} from "@/app/feed/subscription-actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    postSubscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
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

describe("togglePostSubscription", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await togglePostSubscription(
      prevState,
      makeFormData({ userId: "u2" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if userId is missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await togglePostSubscription(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("User ID required");
  });

  it("prevents subscribing to yourself", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await togglePostSubscription(
      prevState,
      makeFormData({ userId: "user1" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Cannot subscribe to yourself");
  });

  it("creates subscription when not subscribed", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.postSubscription.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.postSubscription.create.mockResolvedValueOnce({} as never);

    const result = await togglePostSubscription(
      prevState,
      makeFormData({ userId: "user2" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Subscribed to posts");
    expect(mockPrisma.postSubscription.create).toHaveBeenCalledWith({
      data: { subscriberId: "user1", subscribedToId: "user2" },
    });
  });

  it("deletes subscription when already subscribed", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.postSubscription.findUnique.mockResolvedValueOnce({
      id: "sub1",
      subscriberId: "user1",
      subscribedToId: "user2",
      createdAt: new Date(),
    } as never);
    mockPrisma.postSubscription.delete.mockResolvedValueOnce({} as never);

    const result = await togglePostSubscription(
      prevState,
      makeFormData({ userId: "user2" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Unsubscribed from posts");
    expect(mockPrisma.postSubscription.delete).toHaveBeenCalledWith({
      where: { id: "sub1" },
    });
  });
});

describe("isSubscribedToUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await isSubscribedToUser("user2");
    expect(result).toBe(false);
  });

  it("returns true when subscription exists", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.postSubscription.findUnique.mockResolvedValueOnce({
      id: "sub1",
      subscriberId: "user1",
      subscribedToId: "user2",
      createdAt: new Date(),
    } as never);

    const result = await isSubscribedToUser("user2");
    expect(result).toBe(true);
  });

  it("returns false when no subscription", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.postSubscription.findUnique.mockResolvedValueOnce(null as never);

    const result = await isSubscribedToUser("user2");
    expect(result).toBe(false);
  });
});
