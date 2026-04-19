import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userList: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userListMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    userListSubscription: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    block: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    post: {
      findMany: vi.fn(),
    },
    repost: {
      findMany: vi.fn(),
    },
    closeFriend: {
      findMany: vi.fn(),
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
    userFollowing: (id: string) => `user:${id}:following`,
    userBlockedIds: (id: string) => `user:${id}:blocked`,
  },
}));

vi.mock("@/app/feed/block-actions", () => ({
  getAllBlockRelatedIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import {
  createList,
  deleteList,
  renameList,
  addMemberToList,
  toggleListSubscription,
  removeMemberFromList,
  addUserToMultipleLists,
  getUserLists,
  getListMembers,
  getUserListMemberships,
  searchUsersForList,
} from "@/app/lists/actions";

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

// ---------------------------------------------------------------------------
// createList
// ---------------------------------------------------------------------------
describe("createList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await createList(prevState, makeFormData({ name: "Test" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("Not authenticated");
  });

  it("returns error when rate limited", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(isRateLimited).mockResolvedValueOnce(true);
    const result = await createList(prevState, makeFormData({ name: "Test" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("Too many requests");
  });

  it("returns error for empty name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const result = await createList(prevState, makeFormData({ name: "" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("between 1 and 50");
  });

  it("returns error for name over 50 chars", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const result = await createList(prevState, makeFormData({ name: "a".repeat(51) }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("between 1 and 50");
  });

  it("returns error for duplicate name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "existing" } as never);
    const result = await createList(prevState, makeFormData({ name: "My List" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("already have a list");
  });

  it("creates list successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue(null);
    mockPrisma.userList.create.mockResolvedValue({ id: "new-list" } as never);
    const result = await createList(prevState, makeFormData({ name: "My List" }));
    expect(result.success).toBe(true);
    expect(mockPrisma.userList.create).toHaveBeenCalledWith({
      data: { name: "My List", ownerId: "u1", isNsfw: false },
    });
  });
});

// ---------------------------------------------------------------------------
// deleteList
// ---------------------------------------------------------------------------
describe("deleteList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await deleteList(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
  });

  it("returns error when list not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue(null);
    const result = await deleteList(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("returns error when not owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2" } as never);
    const result = await deleteList(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("not owned");
  });

  it("deletes list successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u1" } as never);
    mockPrisma.userList.delete.mockResolvedValue({} as never);
    const result = await deleteList(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(true);
    expect(mockPrisma.userList.delete).toHaveBeenCalledWith({ where: { id: "l1" } });
  });
});

// ---------------------------------------------------------------------------
// renameList
// ---------------------------------------------------------------------------
describe("renameList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await renameList(prevState, makeFormData({ listId: "l1", name: "New" }));
    expect(result.success).toBe(false);
  });

  it("returns error when not owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValueOnce({ id: "l1", ownerId: "u2" } as never);
    const result = await renameList(prevState, makeFormData({ listId: "l1", name: "New" }));
    expect(result.success).toBe(false);
  });

  it("returns error for duplicate name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValueOnce({ id: "l1", ownerId: "u1" } as never);
    mockPrisma.userList.findUnique.mockResolvedValueOnce({ id: "l2", ownerId: "u1" } as never);
    const result = await renameList(prevState, makeFormData({ listId: "l1", name: "Existing" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("already have a list");
  });

  it("renames successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValueOnce({ id: "l1", ownerId: "u1" } as never);
    mockPrisma.userList.findUnique.mockResolvedValueOnce(null);
    mockPrisma.userList.update.mockResolvedValue({} as never);
    const result = await renameList(prevState, makeFormData({ listId: "l1", name: "New Name" }));
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// addMemberToList
// ---------------------------------------------------------------------------
describe("addMemberToList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await addMemberToList(prevState, makeFormData({ listId: "l1", userId: "u2" }));
    expect(result.success).toBe(false);
  });

  it("returns error when not owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2" } as never);
    const result = await addMemberToList(prevState, makeFormData({ listId: "l1", userId: "u3" }));
    expect(result.success).toBe(false);
  });

  it("returns error when blocked", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u1" } as never);
    mockPrisma.block.findFirst.mockResolvedValue({ id: "b1" } as never);
    const result = await addMemberToList(prevState, makeFormData({ listId: "l1", userId: "u2" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("Cannot add");
  });

  it("returns error when already in list", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u1" } as never);
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.userListMember.findUnique.mockResolvedValue({ id: "m1" } as never);
    const result = await addMemberToList(prevState, makeFormData({ listId: "l1", userId: "u2" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("already in");
  });

  it("adds member successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u1" } as never);
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.userListMember.findUnique.mockResolvedValue(null);
    mockPrisma.userListMember.create.mockResolvedValue({} as never);
    const result = await addMemberToList(prevState, makeFormData({ listId: "l1", userId: "u2" }));
    expect(result.success).toBe(true);
    expect(mockPrisma.userListMember.create).toHaveBeenCalledWith({
      data: { listId: "l1", userId: "u2" },
    });
  });
});

// ---------------------------------------------------------------------------
// removeMemberFromList
// ---------------------------------------------------------------------------
describe("removeMemberFromList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await removeMemberFromList(prevState, makeFormData({ listId: "l1", userId: "u2" }));
    expect(result.success).toBe(false);
  });

  it("returns error when not owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2" } as never);
    const result = await removeMemberFromList(prevState, makeFormData({ listId: "l1", userId: "u3" }));
    expect(result.success).toBe(false);
  });

  it("returns error when member not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u1" } as never);
    mockPrisma.userListMember.findUnique.mockResolvedValue(null);
    const result = await removeMemberFromList(prevState, makeFormData({ listId: "l1", userId: "u2" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("not in this list");
  });

  it("removes member successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u1" } as never);
    mockPrisma.userListMember.findUnique.mockResolvedValue({ id: "m1" } as never);
    mockPrisma.userListMember.delete.mockResolvedValue({} as never);
    const result = await removeMemberFromList(prevState, makeFormData({ listId: "l1", userId: "u2" }));
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// addUserToMultipleLists
// ---------------------------------------------------------------------------
describe("addUserToMultipleLists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await addUserToMultipleLists(["l1"], "u2");
    expect(result.success).toBe(false);
  });

  it("returns error when blocked", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findMany.mockResolvedValue([{ id: "l1" }] as never);
    mockPrisma.block.findFirst.mockResolvedValue({ id: "b1" } as never);
    const result = await addUserToMultipleLists(["l1"], "u2");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Cannot add");
  });

  it("adds and removes memberships correctly", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findMany.mockResolvedValue([{ id: "l1" }, { id: "l2" }, { id: "l3" }] as never);
    mockPrisma.block.findFirst.mockResolvedValue(null);
    // Currently in l1 and l2, requesting l2 and l3
    mockPrisma.userListMember.findMany.mockResolvedValue([
      { listId: "l1" },
      { listId: "l2" },
    ] as never);
    mockPrisma.userListMember.create.mockResolvedValue({} as never);
    mockPrisma.userListMember.delete.mockResolvedValue({} as never);

    const result = await addUserToMultipleLists(["l2", "l3"], "u2");
    expect(result.success).toBe(true);
    // Should add to l3 (new)
    expect(mockPrisma.userListMember.create).toHaveBeenCalledWith({
      data: { listId: "l3", userId: "u2" },
    });
    // Should remove from l1 (no longer selected)
    expect(mockPrisma.userListMember.delete).toHaveBeenCalledWith({
      where: { listId_userId: { listId: "l1", userId: "u2" } },
    });
    // l2 unchanged - no create or delete for it
    expect(mockPrisma.userListMember.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.userListMember.delete).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getUserLists
// ---------------------------------------------------------------------------
describe("getUserLists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await getUserLists();
    expect(result).toEqual([]);
  });

  it("returns lists with member count", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const mockLists = [
      { id: "l1", name: "List 1", _count: { members: 3 } },
      { id: "l2", name: "List 2", _count: { members: 0 } },
    ];
    mockPrisma.userList.findMany.mockResolvedValue(mockLists as never);
    const result = await getUserLists();
    expect(result).toEqual(mockLists);
  });
});

// ---------------------------------------------------------------------------
// getListMembers
// ---------------------------------------------------------------------------
describe("getListMembers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await getListMembers("l1");
    expect(result).toBeNull();
  });

  it("returns null when list not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue(null);
    const result = await getListMembers("l1");
    expect(result).toBeNull();
  });

  it("returns list and members", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({
      id: "l1",
      name: "Test List",
      ownerId: "u1",
    } as never);
    const mockMembers = [
      { id: "m1", userId: "u2", user: { id: "u2", username: "bob" } },
    ];
    mockPrisma.userListMember.findMany.mockResolvedValue(mockMembers as never);
    const result = await getListMembers("l1");
    expect(result).not.toBeNull();
    expect(result!.list.name).toBe("Test List");
    expect(result!.members).toEqual(mockMembers);
  });
});

// ---------------------------------------------------------------------------
// getUserListMemberships
// ---------------------------------------------------------------------------
describe("getUserListMemberships", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await getUserListMemberships("u2");
    expect(result).toEqual([]);
  });

  it("returns lists with isMember flags", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findMany.mockResolvedValue([
      { id: "l1", name: "A", members: [{ id: "m1" }] },
      { id: "l2", name: "B", members: [] },
    ] as never);
    const result = await getUserListMemberships("u2");
    expect(result).toEqual([
      { id: "l1", name: "A", isMember: true },
      { id: "l2", name: "B", isMember: false },
    ]);
  });
});

// ---------------------------------------------------------------------------
// searchUsersForList
// ---------------------------------------------------------------------------
describe("searchUsersForList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await searchUsersForList("l1", "bob");
    expect(result).toEqual({ users: [], hasMore: false });
  });

  it("returns empty for short queries", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const result = await searchUsersForList("l1", "b");
    expect(result).toEqual({ users: [], hasMore: false });
  });

  it("returns users with isInList flag", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u2",
        username: "bob",
        displayName: "Bob",
        name: "Bob",
        avatar: null,
        image: null,
        profileFrameId: null,
        usernameFont: null,
        userListMembers: [{ id: "m1" }],
      },
      {
        id: "u3",
        username: "bobby",
        displayName: "Bobby",
        name: "Bobby",
        avatar: null,
        image: null,
        profileFrameId: null,
        usernameFont: null,
        userListMembers: [],
      },
    ] as never);
    const result = await searchUsersForList("l1", "bob");
    expect(result.users).toHaveLength(2);
    expect(result.users[0].isInList).toBe(true);
    expect(result.users[1].isInList).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toggleListSubscription
// ---------------------------------------------------------------------------
describe("toggleListSubscription", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await toggleListSubscription(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
  });

  it("returns error when list not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue(null);
    const result = await toggleListSubscription(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("returns error when subscribing to own list", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u1" } as never);
    const result = await toggleListSubscription(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("own this list");
  });

  it("subscribes when not already subscribed", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2" } as never);
    mockPrisma.userListSubscription.findUnique.mockResolvedValue(null);
    mockPrisma.userListSubscription.create.mockResolvedValue({} as never);
    const result = await toggleListSubscription(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Subscribed");
    expect(mockPrisma.userListSubscription.create).toHaveBeenCalled();
  });

  it("sends LIST_SUBSCRIBE notification to list owner when subscribing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2" } as never);
    mockPrisma.userListSubscription.findUnique.mockResolvedValue(null);
    mockPrisma.userListSubscription.create.mockResolvedValue({} as never);
    await toggleListSubscription(prevState, makeFormData({ listId: "l1" }));
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "LIST_SUBSCRIBE",
      actorId: "u1",
      targetUserId: "u2",
    });
  });

  it("unsubscribes when already subscribed", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2" } as never);
    mockPrisma.userListSubscription.findUnique.mockResolvedValue({ id: "s1" } as never);
    mockPrisma.userListSubscription.delete.mockResolvedValue({} as never);
    const result = await toggleListSubscription(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Unsubscribed");
    expect(mockPrisma.userListSubscription.delete).toHaveBeenCalled();
  });

  it("does not send notification when unsubscribing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2" } as never);
    mockPrisma.userListSubscription.findUnique.mockResolvedValue({ id: "s1" } as never);
    mockPrisma.userListSubscription.delete.mockResolvedValue({} as never);
    await toggleListSubscription(prevState, makeFormData({ listId: "l1" }));
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});
