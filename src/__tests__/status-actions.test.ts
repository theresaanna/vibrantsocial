import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userStatus: {
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    friendRequest: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    block: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: null,
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  cacheKeys: {
    friendStatuses: (id: string) => `user:${id}:friend-statuses`,
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  setStatus,
  deleteStatus,
  getFriendStatuses,
  getUserStatusHistory,
} from "@/app/feed/status-actions";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

const defaultState = { success: false, message: "" };

describe("setStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as any);
    mockPrisma.userStatus.create.mockResolvedValue({ id: "s1" } as any);
  });

  it("creates a status on success", async () => {
    const result = await setStatus(defaultState, makeFormData({ content: "Hello world" }));

    expect(result.success).toBe(true);
    expect(mockPrisma.userStatus.create).toHaveBeenCalledWith({
      data: { userId: "user1", content: "Hello world" },
    });
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValue(null as any);

    const result = await setStatus(defaultState, makeFormData({ content: "Hi" }));

    expect(result.success).toBe(false);
    expect(result.message).toContain("Not authenticated");
  });

  it("returns error if content is empty", async () => {
    const result = await setStatus(defaultState, makeFormData({ content: "   " }));

    expect(result.success).toBe(false);
    expect(result.message).toContain("empty");
  });

  it("returns error if content exceeds 280 characters", async () => {
    const result = await setStatus(
      defaultState,
      makeFormData({ content: "a".repeat(281) }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("280");
  });
});

describe("deleteStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as any);
    mockPrisma.userStatus.findUnique.mockResolvedValue({ userId: "user1" } as any);
    mockPrisma.userStatus.delete.mockResolvedValue({} as any);
  });

  it("deletes the status on success", async () => {
    const result = await deleteStatus(
      defaultState,
      makeFormData({ statusId: "s1" }),
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.userStatus.delete).toHaveBeenCalledWith({
      where: { id: "s1" },
    });
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValue(null as any);

    const result = await deleteStatus(
      defaultState,
      makeFormData({ statusId: "s1" }),
    );

    expect(result.success).toBe(false);
  });

  it("returns error if status not found", async () => {
    mockPrisma.userStatus.findUnique.mockResolvedValue(null);

    const result = await deleteStatus(
      defaultState,
      makeFormData({ statusId: "missing" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("returns error if user does not own the status", async () => {
    mockPrisma.userStatus.findUnique.mockResolvedValue({ userId: "other" } as any);

    const result = await deleteStatus(
      defaultState,
      makeFormData({ statusId: "s1" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("own");
  });
});

describe("getFriendStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as any);
  });

  it("returns empty array if not authenticated", async () => {
    mockAuth.mockResolvedValue(null as any);

    const result = await getFriendStatuses();

    expect(result).toEqual([]);
  });

  it("returns statuses from friends", async () => {
    mockPrisma.friendRequest.findMany.mockResolvedValue([
      { senderId: "user1", receiverId: "friend1" },
      { senderId: "friend2", receiverId: "user1" },
    ] as any);

    const now = new Date();
    mockPrisma.userStatus.findMany.mockResolvedValue([
      {
        id: "s1",
        content: "Hey!",
        createdAt: now,
        user: {
          id: "friend1",
          username: "friend1",
          displayName: "Friend One",
          name: null,
          avatar: null,
          image: null,
          profileFrameId: null,
          usernameFont: null,
        },
      },
    ] as any);

    const result = await getFriendStatuses();

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Hey!");
    expect(result[0].user.username).toBe("friend1");
  });

  it("returns empty array when user has no friends", async () => {
    mockPrisma.friendRequest.findMany.mockResolvedValue([]);

    const result = await getFriendStatuses();

    expect(result).toEqual([]);
    expect(mockPrisma.userStatus.findMany).not.toHaveBeenCalled();
  });
});

describe("getUserStatusHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as any);
    mockPrisma.block.findFirst.mockResolvedValue(null);
  });

  it("returns statuses for a valid user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user2" } as any);

    const now = new Date();
    mockPrisma.userStatus.findMany.mockResolvedValue([
      {
        id: "s1",
        content: "Status 1",
        createdAt: now,
        user: {
          id: "user2",
          username: "alice",
          displayName: "Alice",
          name: null,
          avatar: null,
          image: null,
          profileFrameId: null,
          usernameFont: null,
        },
      },
    ] as any);

    const result = await getUserStatusHistory("alice");

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Status 1");
  });

  it("returns empty array if user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await getUserStatusHistory("nobody");

    expect(result).toEqual([]);
  });

  it("returns empty array if blocked", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user2" } as any);
    mockPrisma.block.findFirst.mockResolvedValue({ id: "block1" } as any);

    const result = await getUserStatusHistory("blocked-user");

    expect(result).toEqual([]);
  });
});
