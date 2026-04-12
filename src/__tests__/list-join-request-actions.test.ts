import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userList: {
      findUnique: vi.fn(),
    },
    userListMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    userListJoinRequest: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    block: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
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

vi.mock("@/lib/inngest", () => ({
  inngest: { send: vi.fn() },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { inngest } from "@/lib/inngest";
import { invalidate } from "@/lib/cache";
import {
  requestToJoinList,
  approveListJoinRequest,
  declineListJoinRequest,
  respondToListJoinRequestByActor,
  getListJoinRequestStatus,
} from "@/app/lists/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockCreateNotification = vi.mocked(createNotification);
const mockInngest = vi.mocked(inngest);

const prevState = { success: false, message: "" };

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

// ---------------------------------------------------------------------------
// requestToJoinList
// ---------------------------------------------------------------------------
describe("requestToJoinList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await requestToJoinList(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("Not authenticated");
  });

  it("returns error when rate limited", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(isRateLimited).mockResolvedValueOnce(true);
    const result = await requestToJoinList(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("Too many requests");
  });

  it("returns error when list not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue(null);
    const result = await requestToJoinList(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("returns error when requesting to join own list", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u1", name: "My List" } as never);
    const result = await requestToJoinList(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("own this list");
  });

  it("returns error when blocked by list owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2", name: "List" } as never);
    mockPrisma.block.findFirst.mockResolvedValue({ id: "b1" } as never);
    const result = await requestToJoinList(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("Cannot request");
  });

  it("returns error when already a member", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2", name: "List" } as never);
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.userListMember.findUnique.mockResolvedValue({ id: "m1" } as never);
    const result = await requestToJoinList(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("already in this list");
  });

  it("returns error when request already pending", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2", name: "List" } as never);
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.userListMember.findUnique.mockResolvedValue(null);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({ id: "jr1", status: "PENDING" } as never);
    const result = await requestToJoinList(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("already pending");
  });

  it("creates join request successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2", name: "List" } as never);
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.userListMember.findUnique.mockResolvedValue(null);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue(null);
    mockPrisma.userListJoinRequest.create.mockResolvedValue({} as never);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await requestToJoinList(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(true);
    expect(result.message).toContain("Join request sent");
    expect(mockPrisma.userListJoinRequest.create).toHaveBeenCalledWith({
      data: { listId: "l1", userId: "u1" },
    });
  });

  it("re-requests after a previous decline", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2", name: "List" } as never);
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.userListMember.findUnique.mockResolvedValue(null);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({ id: "jr1", status: "DECLINED" } as never);
    mockPrisma.userListJoinRequest.update.mockResolvedValue({} as never);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await requestToJoinList(prevState, makeFormData({ listId: "l1" }));
    expect(result.success).toBe(true);
    expect(mockPrisma.userListJoinRequest.update).toHaveBeenCalledWith({
      where: { id: "jr1" },
      data: { status: "PENDING" },
    });
  });

  it("notifies only the list owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2", name: "List" } as never);
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.userListMember.findUnique.mockResolvedValue(null);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue(null);
    mockPrisma.userListJoinRequest.create.mockResolvedValue({} as never);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await requestToJoinList(prevState, makeFormData({ listId: "l1" }));
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "LIST_JOIN_REQUEST",
      actorId: "u1",
      targetUserId: "u2",
      userListId: "l1",
    });
  });

  it("sends email when owner has email preference enabled", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2", name: "Cool List" } as never);
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.userListMember.findUnique.mockResolvedValue(null);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue(null);
    mockPrisma.userListJoinRequest.create.mockResolvedValue({} as never);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ email: "owner@test.com", emailOnListJoinRequest: true } as never)
      .mockResolvedValueOnce({ displayName: "Alice", username: "alice", name: "Alice" } as never);

    await requestToJoinList(prevState, makeFormData({ listId: "l1" }));
    expect(mockInngest.send).toHaveBeenCalledWith({
      name: "email/list-join-request",
      data: { toEmail: "owner@test.com", requesterName: "Alice", listName: "Cool List" },
    });
  });

  it("does not send email when owner has preference disabled", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userList.findUnique.mockResolvedValue({ id: "l1", ownerId: "u2", name: "List" } as never);
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.userListMember.findUnique.mockResolvedValue(null);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue(null);
    mockPrisma.userListJoinRequest.create.mockResolvedValue({} as never);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ email: "owner@test.com", emailOnListJoinRequest: false } as never)
      .mockResolvedValueOnce({ displayName: "Alice" } as never);

    await requestToJoinList(prevState, makeFormData({ listId: "l1" }));
    expect(mockInngest.send).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// approveListJoinRequest
// ---------------------------------------------------------------------------
describe("approveListJoinRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await approveListJoinRequest(prevState, makeFormData({ requestId: "jr1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("Not authenticated");
  });

  it("returns error when request not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue(null);
    const result = await approveListJoinRequest(prevState, makeFormData({ requestId: "jr1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("returns error when not the list owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({
      id: "jr1",
      listId: "l1",
      userId: "u3",
      status: "PENDING",
      list: { id: "l1", ownerId: "u2" },
    } as never);
    const result = await approveListJoinRequest(prevState, makeFormData({ requestId: "jr1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("Only the list owner");
  });

  it("returns error when request already handled", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({
      id: "jr1",
      listId: "l1",
      userId: "u3",
      status: "APPROVED",
      list: { id: "l1", ownerId: "u1" },
    } as never);
    const result = await approveListJoinRequest(prevState, makeFormData({ requestId: "jr1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("already handled");
  });

  it("approves request and adds member", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({
      id: "jr1",
      listId: "l1",
      userId: "u3",
      status: "PENDING",
      list: { id: "l1", ownerId: "u1" },
    } as never);
    mockPrisma.userListJoinRequest.update.mockResolvedValue({} as never);
    mockPrisma.userListMember.create.mockResolvedValue({} as never);

    const result = await approveListJoinRequest(prevState, makeFormData({ requestId: "jr1" }));
    expect(result.success).toBe(true);
    expect(result.message).toContain("approved");
    expect(mockPrisma.userListJoinRequest.update).toHaveBeenCalledWith({
      where: { id: "jr1" },
      data: { status: "APPROVED" },
    });
    expect(mockPrisma.userListMember.create).toHaveBeenCalledWith({
      data: { listId: "l1", userId: "u3" },
    });
  });

  it("sends LIST_ADD notification to the requester on approval", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({
      id: "jr1",
      listId: "l1",
      userId: "u3",
      status: "PENDING",
      list: { id: "l1", ownerId: "u1" },
    } as never);
    mockPrisma.userListJoinRequest.update.mockResolvedValue({} as never);
    mockPrisma.userListMember.create.mockResolvedValue({} as never);

    await approveListJoinRequest(prevState, makeFormData({ requestId: "jr1" }));
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "LIST_ADD",
      actorId: "u1",
      targetUserId: "u3",
      userListId: "l1",
    });
  });

  it("invalidates list members cache on approval", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({
      id: "jr1",
      listId: "l1",
      userId: "u3",
      status: "PENDING",
      list: { id: "l1", ownerId: "u1" },
    } as never);
    mockPrisma.userListJoinRequest.update.mockResolvedValue({} as never);
    mockPrisma.userListMember.create.mockResolvedValue({} as never);

    await approveListJoinRequest(prevState, makeFormData({ requestId: "jr1" }));
    expect(vi.mocked(invalidate)).toHaveBeenCalledWith("list:l1:members");
  });
});

// ---------------------------------------------------------------------------
// declineListJoinRequest
// ---------------------------------------------------------------------------
describe("declineListJoinRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await declineListJoinRequest(prevState, makeFormData({ requestId: "jr1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("Not authenticated");
  });

  it("returns error when request not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue(null);
    const result = await declineListJoinRequest(prevState, makeFormData({ requestId: "jr1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("returns error when not the list owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({
      id: "jr1",
      listId: "l1",
      userId: "u3",
      status: "PENDING",
      list: { id: "l1", ownerId: "u2" },
    } as never);
    const result = await declineListJoinRequest(prevState, makeFormData({ requestId: "jr1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("Only the list owner");
  });

  it("returns error when request already handled", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({
      id: "jr1",
      listId: "l1",
      userId: "u3",
      status: "DECLINED",
      list: { id: "l1", ownerId: "u1" },
    } as never);
    const result = await declineListJoinRequest(prevState, makeFormData({ requestId: "jr1" }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("already handled");
  });

  it("declines request successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({
      id: "jr1",
      listId: "l1",
      userId: "u3",
      status: "PENDING",
      list: { id: "l1", ownerId: "u1" },
    } as never);
    mockPrisma.userListJoinRequest.update.mockResolvedValue({} as never);

    const result = await declineListJoinRequest(prevState, makeFormData({ requestId: "jr1" }));
    expect(result.success).toBe(true);
    expect(result.message).toContain("declined");
    expect(mockPrisma.userListJoinRequest.update).toHaveBeenCalledWith({
      where: { id: "jr1" },
      data: { status: "DECLINED" },
    });
  });

  it("does not send notification on decline", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({
      id: "jr1",
      listId: "l1",
      userId: "u3",
      status: "PENDING",
      list: { id: "l1", ownerId: "u1" },
    } as never);
    mockPrisma.userListJoinRequest.update.mockResolvedValue({} as never);

    await declineListJoinRequest(prevState, makeFormData({ requestId: "jr1" }));
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// respondToListJoinRequestByActor
// ---------------------------------------------------------------------------
describe("respondToListJoinRequestByActor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await respondToListJoinRequestByActor("u3", "l1", "approve");
    expect(result.success).toBe(false);
  });

  it("returns error when no pending request found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findFirst.mockResolvedValue(null);
    const result = await respondToListJoinRequestByActor("u3", "l1", "approve");
    expect(result.success).toBe(false);
    expect(result.message).toContain("No pending join request");
  });

  it("returns error when not the list owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findFirst.mockResolvedValue({
      id: "jr1",
      listId: "l1",
      userId: "u3",
      status: "PENDING",
      list: { id: "l1", ownerId: "u2" },
    } as never);
    const result = await respondToListJoinRequestByActor("u3", "l1", "approve");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Only the list owner");
  });

  it("approves via actor lookup", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findFirst.mockResolvedValue({
      id: "jr1",
      listId: "l1",
      userId: "u3",
      status: "PENDING",
      list: { id: "l1", ownerId: "u1" },
    } as never);
    mockPrisma.userListJoinRequest.update.mockResolvedValue({} as never);
    mockPrisma.userListMember.create.mockResolvedValue({} as never);

    const result = await respondToListJoinRequestByActor("u3", "l1", "approve");
    expect(result.success).toBe(true);
    expect(result.message).toContain("approved");
    expect(mockPrisma.userListMember.create).toHaveBeenCalledWith({
      data: { listId: "l1", userId: "u3" },
    });
  });

  it("declines via actor lookup", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findFirst.mockResolvedValue({
      id: "jr1",
      listId: "l1",
      userId: "u3",
      status: "PENDING",
      list: { id: "l1", ownerId: "u1" },
    } as never);
    mockPrisma.userListJoinRequest.update.mockResolvedValue({} as never);

    const result = await respondToListJoinRequestByActor("u3", "l1", "decline");
    expect(result.success).toBe(true);
    expect(result.message).toContain("declined");
    expect(mockPrisma.userListMember.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getListJoinRequestStatus
// ---------------------------------------------------------------------------
describe("getListJoinRequestStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns none when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await getListJoinRequestStatus("l1");
    expect(result).toBe("none");
  });

  it("returns none when no request exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue(null);
    const result = await getListJoinRequestStatus("l1");
    expect(result).toBe("none");
  });

  it("returns pending when request is pending", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({ status: "PENDING" } as never);
    const result = await getListJoinRequestStatus("l1");
    expect(result).toBe("pending");
  });

  it("returns approved when request is approved", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({ status: "APPROVED" } as never);
    const result = await getListJoinRequestStatus("l1");
    expect(result).toBe("approved");
  });

  it("returns declined when request is declined", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.userListJoinRequest.findUnique.mockResolvedValue({ status: "DECLINED" } as never);
    const result = await getListJoinRequestStatus("l1");
    expect(result).toBe("declined");
  });
});
