import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  linkAccount,
  unlinkAccount,
  switchAccount,
  getLinkedAccounts,
} from "@/app/profile/account-linking-actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    linkedAccountGroup: {
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockBcrypt = vi.mocked(bcrypt);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };

const mockSession = {
  user: {
    id: "user1",
    username: "user_one",
    displayName: "User One",
    avatar: null,
    bio: null,
    tier: "free",
    isEmailVerified: true,
    authProvider: "credentials",
    linkedAccounts: [],
  },
  expires: "2026-12-31",
};

describe("getLinkedAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getLinkedAccounts();
    expect(result).toEqual([]);
  });

  it("returns empty array when user has no group", async () => {
    mockAuth.mockResolvedValue(mockSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    mockPrisma.user.findUnique.mockResolvedValue({
      linkedAccountGroupId: null,
    } as never);
    const result = await getLinkedAccounts();
    expect(result).toEqual([]);
  });

  it("returns linked accounts when user has a group", async () => {
    mockAuth.mockResolvedValue(mockSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    mockPrisma.user.findUnique.mockResolvedValue({
      linkedAccountGroupId: "group1",
    } as never);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user2", username: "user_two", displayName: "User Two", avatar: null },
    ] as never);

    const result = await getLinkedAccounts();
    expect(result).toEqual([
      { id: "user2", username: "user_two", displayName: "User Two", avatar: null },
    ]);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        linkedAccountGroupId: "group1",
        id: { not: "user1" },
      },
      select: { id: true, username: true, displayName: true, avatar: true },
    });
  });
});

describe("linkAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await linkAccount(
      prevState,
      makeFormData({ email: "other@example.com", password: "pass" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error when email or password missing", async () => {
    mockAuth.mockResolvedValue(mockSession as never);
    const result = await linkAccount(prevState, makeFormData({ email: "", password: "" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Email and password are required");
  });

  it("returns error for invalid credentials", async () => {
    mockAuth.mockResolvedValue(mockSession as never);
    mockPrisma.user.findUnique.mockResolvedValue(null as never);

    const result = await linkAccount(
      prevState,
      makeFormData({ email: "other@example.com", password: "wrongpass" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email or password");
  });

  it("returns error for wrong password", async () => {
    mockAuth.mockResolvedValue(mockSession as never);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user2",
      username: "user_two",
      displayName: "User Two",
      avatar: null,
      passwordHash: "hashed",
      linkedAccountGroupId: null,
    } as never);
    mockBcrypt.compare.mockResolvedValue(false as never);

    const result = await linkAccount(
      prevState,
      makeFormData({ email: "other@example.com", password: "wrongpass" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email or password");
  });

  it("prevents linking to self", async () => {
    mockAuth.mockResolvedValue(mockSession as never);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user1",
      username: "user_one",
      displayName: "User One",
      avatar: null,
      passwordHash: "hashed",
      linkedAccountGroupId: null,
    } as never);
    mockBcrypt.compare.mockResolvedValue(true as never);

    const result = await linkAccount(
      prevState,
      makeFormData({ email: "self@example.com", password: "pass" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Cannot link to your own account");
  });

  it("prevents linking already-linked accounts", async () => {
    mockAuth.mockResolvedValue(mockSession as never);

    // First call: target user lookup (with passwordHash)
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user2",
      username: "user_two",
      displayName: "User Two",
      avatar: null,
      passwordHash: "hashed",
      linkedAccountGroupId: "group1",
    } as never);
    mockBcrypt.compare.mockResolvedValue(true as never);

    // Second call: current user lookup (group check)
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "group1",
    } as never);

    const result = await linkAccount(
      prevState,
      makeFormData({ email: "other@example.com", password: "pass" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("This account is already linked");
  });

  it("creates new group when neither user has one", async () => {
    mockAuth.mockResolvedValue(mockSession as never);

    // Target user (with credentials)
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user2",
      username: "user_two",
      displayName: "User Two",
      avatar: null,
      passwordHash: "hashed",
      linkedAccountGroupId: null,
    } as never);
    mockBcrypt.compare.mockResolvedValue(true as never);

    // Current user
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: null,
    } as never);

    // Group creation
    mockPrisma.linkedAccountGroup.create.mockResolvedValue({ id: "newgroup" } as never);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 2 } as never);

    // Final user lookup for updated group
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "newgroup",
    } as never);

    // Linked accounts query
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user2", username: "user_two", displayName: "User Two", avatar: null },
    ] as never);

    const result = await linkAccount(
      prevState,
      makeFormData({ email: "other@example.com", password: "pass" })
    );
    expect(result.success).toBe(true);
    expect(result.linkedAccounts).toHaveLength(1);
    expect(mockPrisma.linkedAccountGroup.create).toHaveBeenCalledWith({ data: {} });
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["user1", "user2"] } },
      data: { linkedAccountGroupId: "newgroup" },
    });
  });

  it("adds target to current user's group", async () => {
    mockAuth.mockResolvedValue(mockSession as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user2",
      username: "user_two",
      displayName: "User Two",
      avatar: null,
      passwordHash: "hashed",
      linkedAccountGroupId: null,
    } as never);
    mockBcrypt.compare.mockResolvedValue(true as never);

    // Current user has a group
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "existing-group",
    } as never);

    mockPrisma.user.update.mockResolvedValue({} as never);

    // Final lookup
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "existing-group",
    } as never);

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user2", username: "user_two", displayName: "User Two", avatar: null },
    ] as never);

    const result = await linkAccount(
      prevState,
      makeFormData({ email: "other@example.com", password: "pass" })
    );
    expect(result.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user2" },
      data: { linkedAccountGroupId: "existing-group" },
    });
  });

  it("merges groups when both users have groups", async () => {
    mockAuth.mockResolvedValue(mockSession as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user2",
      username: "user_two",
      displayName: "User Two",
      avatar: null,
      passwordHash: "hashed",
      linkedAccountGroupId: "group-b",
    } as never);
    mockBcrypt.compare.mockResolvedValue(true as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "group-a",
    } as never);

    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.linkedAccountGroup.delete.mockResolvedValue({} as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "group-a",
    } as never);

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user2", username: "user_two", displayName: "User Two", avatar: null },
    ] as never);

    const result = await linkAccount(
      prevState,
      makeFormData({ email: "other@example.com", password: "pass" })
    );
    expect(result.success).toBe(true);
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { linkedAccountGroupId: "group-b" },
      data: { linkedAccountGroupId: "group-a" },
    });
    expect(mockPrisma.linkedAccountGroup.delete).toHaveBeenCalledWith({
      where: { id: "group-b" },
    });
  });
});

describe("unlinkAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await unlinkAccount("user2");
    expect(result.success).toBe(false);
  });

  it("returns error when user has no group", async () => {
    mockAuth.mockResolvedValue(mockSession as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: null,
    } as never);

    const result = await unlinkAccount("user2");
    expect(result.success).toBe(false);
    expect(result.message).toBe("No linked accounts");
  });

  it("returns error when target is not in the same group", async () => {
    mockAuth.mockResolvedValue(mockSession as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "group1",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user2",
      linkedAccountGroupId: "different-group",
    } as never);

    const result = await unlinkAccount("user2");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Account is not in your linked group");
  });

  it("unlinks account and dissolves group when only 1 member remains", async () => {
    mockAuth.mockResolvedValue(mockSession as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "group1",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user2",
      linkedAccountGroupId: "group1",
    } as never);
    mockPrisma.user.update.mockResolvedValue({} as never);
    mockPrisma.user.count.mockResolvedValue(1 as never);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.linkedAccountGroup.delete.mockResolvedValue({} as never);

    const result = await unlinkAccount("user2");
    expect(result.success).toBe(true);
    expect(result.linkedAccounts).toEqual([]);
    expect(mockPrisma.linkedAccountGroup.delete).toHaveBeenCalled();
  });

  it("unlinks account and keeps group with remaining members", async () => {
    mockAuth.mockResolvedValue(mockSession as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "group1",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user2",
      linkedAccountGroupId: "group1",
    } as never);
    mockPrisma.user.update.mockResolvedValue({} as never);
    mockPrisma.user.count.mockResolvedValue(2 as never);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user3", username: "user_three", displayName: "User Three", avatar: null },
    ] as never);

    const result = await unlinkAccount("user2");
    expect(result.success).toBe(true);
    expect(result.linkedAccounts).toHaveLength(1);
  });
});

describe("switchAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await switchAccount("user2");
    expect(result.success).toBe(false);
  });

  it("returns error when user has no group", async () => {
    mockAuth.mockResolvedValue(mockSession as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: null,
    } as never);

    const result = await switchAccount("user2");
    expect(result.success).toBe(false);
    expect(result.message).toBe("No linked accounts");
  });

  it("returns error when target is not in the same group", async () => {
    mockAuth.mockResolvedValue(mockSession as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "group1",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user2",
      linkedAccountGroupId: "other-group",
      username: "user_two",
      displayName: "User Two",
    } as never);

    const result = await switchAccount("user2");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Account is not in your linked group");
  });

  it("returns success when target is in the same group", async () => {
    mockAuth.mockResolvedValue(mockSession as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "group1",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user2",
      linkedAccountGroupId: "group1",
      username: "user_two",
      displayName: "User Two",
    } as never);

    const result = await switchAccount("user2");
    expect(result.success).toBe(true);
  });
});
