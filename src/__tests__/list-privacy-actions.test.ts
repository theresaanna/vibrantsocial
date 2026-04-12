import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userList: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userListMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    userListSubscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    userListCollaborator: {
      findUnique: vi.fn(),
    },
    block: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: {},
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  cacheKeys: {
    userLists: (id: string) => `user:${id}:lists`,
    userListMembers: (id: string) => `list:${id}:members`,
    userListSubscriptions: (id: string) => `user:${id}:list-subs`,
    userListCollaborators: (id: string) => `list:${id}:collaborators`,
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { invalidate } from "@/lib/cache";
import {
  toggleListPrivacy,
  getListMembers,
  toggleListSubscription,
} from "@/app/lists/actions";

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

// ---------------------------------------------------------------------------
// toggleListPrivacy
// ---------------------------------------------------------------------------
describe("toggleListPrivacy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await toggleListPrivacy(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("Not authenticated");
  });

  it("returns error when not the list owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2", isPrivate: false } as never);
    const result = await toggleListPrivacy(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("not owned by you");
  });

  it("toggles from public to private", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u1", isPrivate: false } as never);
    mockPrisma.userList.update.mockResolvedValue({} as never);
    const result = await toggleListPrivacy(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(true);
    expect(result.message).toContain("now private");
    expect(mockPrisma.userList.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { isPrivate: true },
    });
  });

  it("toggles from private to public", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u1", isPrivate: true } as never);
    mockPrisma.userList.update.mockResolvedValue({} as never);
    const result = await toggleListPrivacy(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(true);
    expect(result.message).toContain("now public");
    expect(mockPrisma.userList.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { isPrivate: false },
    });
  });

  it("invalidates list cache after toggling", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u1", isPrivate: false } as never);
    mockPrisma.userList.update.mockResolvedValue({} as never);
    await toggleListPrivacy(prevState, makeFormData({ listId: "l1" }));
    expect(vi.mocked(invalidate)).toHaveBeenCalledWith("user:u1:lists");
  });
});

// ---------------------------------------------------------------------------
// getListMembers - privacy enforcement
// ---------------------------------------------------------------------------
describe("getListMembers - privacy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for private list when user is not owner, collaborator, or member", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({
      id: "l1",
      name: "Secret List",
      ownerId: "u2",
      isPrivate: true,
      owner: { username: "owner", displayName: "Owner", name: null, avatar: null, image: null, profileFrameId: null },
    } as never);
    mockPrisma.userListCollaborator.findUnique.mockResolvedValue(null);
    mockPrisma.userListMember.findUnique.mockResolvedValue(null);

    const result = await getListMembers("l1");
    expect(result).toBeNull();
  });

  it("allows access to private list for list owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({
      id: "l1",
      name: "My Private List",
      ownerId: "u1",
      isPrivate: true,
      owner: { username: "me", displayName: "Me", name: null, avatar: null, image: null, profileFrameId: null },
    } as never);
    mockPrisma.userListMember.findMany.mockResolvedValue([]);

    const result = await getListMembers("l1");
    expect(result).not.toBeNull();
    expect(result!.list.name).toBe("My Private List");
  });

  it("allows access to private list for collaborator", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({
      id: "l1",
      name: "Collab List",
      ownerId: "u2",
      isPrivate: true,
      owner: { username: "owner", displayName: "Owner", name: null, avatar: null, image: null, profileFrameId: null },
    } as never);
    mockPrisma.userListCollaborator.findUnique.mockResolvedValue({ id: "c1" } as never);
    mockPrisma.userListMember.findMany.mockResolvedValue([]);

    const result = await getListMembers("l1");
    expect(result).not.toBeNull();
  });

  it("allows access to private list for member", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({
      id: "l1",
      name: "Member List",
      ownerId: "u2",
      isPrivate: true,
      owner: { username: "owner", displayName: "Owner", name: null, avatar: null, image: null, profileFrameId: null },
    } as never);
    mockPrisma.userListCollaborator.findUnique.mockResolvedValue(null);
    // First call: privacy check (findUnique for membership)
    mockPrisma.userListMember.findUnique.mockResolvedValue({ id: "m1" } as never);
    // Second call: get all members (findMany)
    mockPrisma.userListMember.findMany.mockResolvedValue([]);

    const result = await getListMembers("l1");
    expect(result).not.toBeNull();
  });

  it("allows access to public list for anyone", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({
      id: "l1",
      name: "Public List",
      ownerId: "u2",
      isPrivate: false,
      owner: { username: "owner", displayName: "Owner", name: null, avatar: null, image: null, profileFrameId: null },
    } as never);
    mockPrisma.userListCollaborator.findUnique.mockResolvedValue(null);
    mockPrisma.userListMember.findMany.mockResolvedValue([]);

    const result = await getListMembers("l1");
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// toggleListSubscription - privacy enforcement
// ---------------------------------------------------------------------------
describe("toggleListSubscription - privacy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when subscribing to a private list as non-member", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2", isPrivate: true } as never);
    mockPrisma.userListMember.findUnique.mockResolvedValue(null);
    mockPrisma.userListCollaborator.findUnique.mockResolvedValue(null);
    const result = await toggleListSubscription(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("private");
  });

  it("allows subscribing to private list when user is a member", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2", isPrivate: true } as never);
    mockPrisma.userListMember.findUnique.mockResolvedValue({ id: "m1" } as never);
    mockPrisma.userListCollaborator.findUnique.mockResolvedValue(null);
    mockPrisma.userListSubscription.findUnique.mockResolvedValue(null);
    mockPrisma.userListSubscription.create.mockResolvedValue({} as never);

    const result = await toggleListSubscription(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Subscribed");
  });

  it("allows subscribing to public list freely", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2", isPrivate: false } as never);
    mockPrisma.userListSubscription.findUnique.mockResolvedValue(null);
    mockPrisma.userListSubscription.create.mockResolvedValue({} as never);

    const result = await toggleListSubscription(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Subscribed");
  });
});
