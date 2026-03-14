/**
 * Tests for the OAuth account linking flow.
 *
 * Regression tests to ensure that when a user initiates OAuth linking from
 * /profile, the accounts are actually linked (instead of just signing in
 * as the new user and redirecting to the feed).
 *
 * The flow:
 * 1. User clicks "Link with Google/Discord" on /profile
 * 2. startOAuthLink() sets a linkFromUserId cookie with the current user's ID
 * 3. signIn() redirects to OAuth provider with callbackUrl: "/profile"
 * 4. OAuth provider returns → JWT callback runs
 * 5. JWT callback reads the cookie to detect linking flow
 * 6. If linking: calls linkUsersInGroup(), sets token to ORIGINAL user
 * 7. If NOT linking: regular sign-in, token set to OAuth user
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  linkUsersInGroup,
  loadLinkedAccounts,
} from "@/lib/account-linking-db";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    linkedAccountGroup: {
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

describe("loadLinkedAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await loadLinkedAccounts("user1");
    expect(result).toEqual([]);
  });

  it("returns empty array when user has no group", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      linkedAccountGroupId: null,
    } as never);
    const result = await loadLinkedAccounts("user1");
    expect(result).toEqual([]);
  });

  it("returns other group members excluding the given user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      linkedAccountGroupId: "group1",
    } as never);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user2", username: "bob", displayName: "Bob", avatar: null },
    ] as never);

    const result = await loadLinkedAccounts("user1");

    expect(result).toEqual([
      { id: "user2", username: "bob", displayName: "Bob", avatar: null },
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

describe("linkUsersInGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when either user is not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: null,
    } as never);

    await linkUsersInGroup("nonexistent", "user2");

    expect(mockPrisma.linkedAccountGroup.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing when both users are already in the same group", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "same-group",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "same-group",
    } as never);

    await linkUsersInGroup("user1", "user2");

    expect(mockPrisma.linkedAccountGroup.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("creates a new group when neither user has one", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: null,
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: null,
    } as never);
    mockPrisma.linkedAccountGroup.create.mockResolvedValue({
      id: "new-group",
    } as never);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 2 } as never);

    await linkUsersInGroup("user1", "user2");

    expect(mockPrisma.linkedAccountGroup.create).toHaveBeenCalledWith({
      data: {},
    });
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["user1", "user2"] } },
      data: { linkedAccountGroupId: "new-group" },
    });
  });

  it("adds userB to userA's existing group", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "groupA",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: null,
    } as never);
    mockPrisma.user.update.mockResolvedValue({} as never);

    await linkUsersInGroup("user1", "user2");

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user2" },
      data: { linkedAccountGroupId: "groupA" },
    });
  });

  it("adds userA to userB's existing group", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: null,
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "groupB",
    } as never);
    mockPrisma.user.update.mockResolvedValue({} as never);

    await linkUsersInGroup("user1", "user2");

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { linkedAccountGroupId: "groupB" },
    });
  });

  it("merges groups when both users have different groups", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "groupA",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      linkedAccountGroupId: "groupB",
    } as never);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.linkedAccountGroup.delete.mockResolvedValue({} as never);

    await linkUsersInGroup("user1", "user2");

    // Should move all users from groupB into groupA
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { linkedAccountGroupId: "groupB" },
      data: { linkedAccountGroupId: "groupA" },
    });
    // Should delete the now-empty groupB
    expect(mockPrisma.linkedAccountGroup.delete).toHaveBeenCalledWith({
      where: { id: "groupB" },
    });
  });
});

/**
 * Tests for the JWT callback's OAuth account-linking logic.
 *
 * The JWT callback in auth.ts detects an OAuth linking flow by reading
 * the `linkFromUserId` cookie. When present, it links accounts and
 * preserves the original user's session instead of switching to the
 * OAuth user.
 *
 * These tests import the auth module and invoke the JWT callback
 * indirectly via the exported NextAuth config.
 */
describe("JWT callback – OAuth linking flow", () => {
  // We test the JWT callback logic by importing the auth config and
  // calling the callback directly. This requires mocking all of auth.ts's
  // dependencies.

  let jwtCallback: Function;
  const mockCookieGet = vi.fn();
  const mockCookieDelete = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Mock dependencies BEFORE importing auth.ts
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        user: {
          findUnique: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn(),
        },
        account: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        linkedAccountGroup: {
          create: vi.fn(),
          delete: vi.fn(),
        },
      },
    }));

    vi.doMock("@/lib/account-linking-db", () => ({
      linkUsersInGroup: vi.fn(),
      loadLinkedAccounts: vi.fn().mockResolvedValue([]),
    }));

    vi.doMock("next/headers", () => ({
      cookies: vi.fn().mockResolvedValue({
        get: mockCookieGet,
        set: vi.fn(),
        delete: mockCookieDelete,
      }),
    }));

    vi.doMock("bcryptjs", () => ({
      default: { compare: vi.fn() },
    }));

    vi.doMock("@/lib/auto-friend", () => ({
      autoFriendNewUser: vi.fn(),
    }));

    vi.doMock("@/lib/inngest", () => ({
      inngest: { send: vi.fn() },
    }));

    vi.doMock("@auth/prisma-adapter", () => ({
      PrismaAdapter: vi.fn(() => ({})),
    }));

    // Mock NextAuth to capture the config
    vi.doMock("next-auth", () => {
      return {
        default: (config: { callbacks: { jwt: Function } }) => {
          jwtCallback = config.callbacks.jwt;
          return {
            handlers: {},
            auth: vi.fn(),
            signIn: vi.fn(),
            signOut: vi.fn(),
          };
        },
      };
    });

    vi.doMock("next-auth/providers/google", () => ({
      default: vi.fn(() => ({})),
    }));

    vi.doMock("next-auth/providers/discord", () => ({
      default: vi.fn(() => ({})),
    }));

    vi.doMock("next-auth/providers/credentials", () => ({
      default: vi.fn(() => ({})),
    }));

    // Import auth.ts to trigger the NextAuth() call and capture jwtCallback
    await import("@/auth");
  });

  it("links accounts when linkFromUserId cookie is present and user IDs differ", async () => {
    const { linkUsersInGroup, loadLinkedAccounts } = await import(
      "@/lib/account-linking-db"
    );
    const { prisma: mockP } = await import("@/lib/prisma");

    // Cookie indicates user1 initiated linking
    mockCookieGet.mockReturnValue({ value: "original-user-id" });

    // Original user found in DB
    vi.mocked(mockP.user.findUnique).mockResolvedValue({
      id: "original-user-id",
      username: "alice",
      displayName: "Alice",
      bio: "Hello",
      avatar: "/alice.png",
      tier: "free",
      emailVerified: new Date(),
    } as never);

    vi.mocked(loadLinkedAccounts).mockResolvedValue([
      {
        id: "oauth-user-id",
        username: "bob",
        displayName: "Bob",
        avatar: null,
      },
    ]);

    const token = {} as Record<string, unknown>;
    const result = await jwtCallback({
      token,
      user: {
        id: "oauth-user-id",
        username: "bob",
        displayName: "Bob",
        bio: null,
        avatar: null,
        tier: "free",
      },
      account: { provider: "google", providerAccountId: "google-123" },
      profile: {},
      trigger: "signIn",
    });

    // Should link the two users
    expect(linkUsersInGroup).toHaveBeenCalledWith(
      "original-user-id",
      "oauth-user-id"
    );

    // Token should be set to the ORIGINAL user, not the OAuth user
    expect(result.id).toBe("original-user-id");
    expect(result.username).toBe("alice");
    expect(result.displayName).toBe("Alice");

    // Should load linked accounts for the original user
    expect(loadLinkedAccounts).toHaveBeenCalledWith("original-user-id");

    // Should clean up the cookie
    expect(mockCookieDelete).toHaveBeenCalledWith("linkFromUserId");
  });

  it("handles same-email linking by creating a new user for the OAuth identity", async () => {
    const { linkUsersInGroup, loadLinkedAccounts } = await import(
      "@/lib/account-linking-db"
    );
    const { prisma: mockP } = await import("@/lib/prisma");

    // Cookie value matches user.id → same-email case
    // (adapter auto-linked the OAuth account to the existing user)
    mockCookieGet.mockReturnValue({ value: "same-user-id" });

    // Create a new user for the OAuth identity
    vi.mocked(mockP.user.create).mockResolvedValue({
      id: "new-oauth-user-id",
    } as never);

    vi.mocked(mockP.account.updateMany).mockResolvedValue({
      count: 1,
    } as never);

    vi.mocked(loadLinkedAccounts).mockResolvedValue([
      {
        id: "new-oauth-user-id",
        username: null,
        displayName: "Google User",
        avatar: null,
      },
    ]);

    const token = {} as Record<string, unknown>;
    const result = await jwtCallback({
      token,
      user: {
        id: "same-user-id",
        username: "alice",
        displayName: "Alice",
        bio: null,
        avatar: null,
        tier: "free",
        image: "https://google.com/photo.jpg",
      },
      account: { provider: "google", providerAccountId: "google-456" },
      profile: { name: "Google User" },
      trigger: "signIn",
    });

    // Should create a new user for the OAuth identity
    expect(mockP.user.create).toHaveBeenCalled();

    // Should move the OAuth Account record to the new user
    expect(mockP.account.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "same-user-id",
        provider: "google",
        providerAccountId: "google-456",
      },
      data: { userId: "new-oauth-user-id" },
    });

    // Should link the original and new users
    expect(linkUsersInGroup).toHaveBeenCalledWith(
      "same-user-id",
      "new-oauth-user-id"
    );

    // Token should remain as the ORIGINAL user
    expect(result.id).toBe("same-user-id");
    expect(result.username).toBe("alice");

    // Should clean up the cookie
    expect(mockCookieDelete).toHaveBeenCalledWith("linkFromUserId");
  });

  it("does NOT link when no cookie is present (regular sign-in)", async () => {
    const { linkUsersInGroup } = await import("@/lib/account-linking-db");

    // No cookie → regular sign-in
    mockCookieGet.mockReturnValue(undefined);

    const token = {} as Record<string, unknown>;
    const result = await jwtCallback({
      token,
      user: {
        id: "oauth-user-id",
        username: "bob",
        displayName: "Bob",
        bio: null,
        avatar: null,
        tier: "free",
      },
      account: { provider: "google", providerAccountId: "google-123" },
      profile: {},
      trigger: "signIn",
    });

    // Should NOT call linkUsersInGroup
    expect(linkUsersInGroup).not.toHaveBeenCalled();

    // Token should be set to the OAuth user (regular sign-in)
    expect(result.id).toBe("oauth-user-id");
    expect(result.username).toBe("bob");
  });

  it("falls back to regular sign-in when original user not found in DB", async () => {
    const { linkUsersInGroup, loadLinkedAccounts } = await import(
      "@/lib/account-linking-db"
    );
    const { prisma: mockP } = await import("@/lib/prisma");

    // Cookie set but original user doesn't exist in DB
    mockCookieGet.mockReturnValue({ value: "deleted-user-id" });

    vi.mocked(mockP.user.findUnique).mockResolvedValue(null);

    const token = {} as Record<string, unknown>;
    const result = await jwtCallback({
      token,
      user: {
        id: "oauth-user-id",
        username: "bob",
        displayName: "Bob",
        bio: null,
        avatar: null,
        tier: "free",
      },
      account: { provider: "google", providerAccountId: "google-123" },
      profile: {},
      trigger: "signIn",
    });

    // Should NOT link (original user doesn't exist)
    expect(linkUsersInGroup).not.toHaveBeenCalled();

    // Should fall through to regular sign-in
    expect(result.id).toBe("oauth-user-id");
  });

  it("preserves original user session fields during linking", async () => {
    const { loadLinkedAccounts } = await import("@/lib/account-linking-db");
    const { prisma: mockP } = await import("@/lib/prisma");

    mockCookieGet.mockReturnValue({ value: "original-user-id" });

    vi.mocked(mockP.user.findUnique).mockResolvedValue({
      id: "original-user-id",
      username: "alice",
      displayName: "Alice Original",
      bio: "My bio",
      avatar: "/alice-avatar.png",
      tier: "pro",
      emailVerified: new Date("2024-01-01"),
    } as never);

    const linkedAccounts = [
      {
        id: "oauth-user-id",
        username: "alice-google",
        displayName: "Alice Google",
        avatar: "/google.png",
      },
    ];
    vi.mocked(loadLinkedAccounts).mockResolvedValue(linkedAccounts);

    const token = {} as Record<string, unknown>;
    const result = await jwtCallback({
      token,
      user: {
        id: "oauth-user-id",
        username: "alice-google",
        displayName: "Alice Google",
        bio: "Different bio",
        avatar: "/google.png",
        tier: "free",
      },
      account: { provider: "google", providerAccountId: "google-789" },
      profile: {},
      trigger: "signIn",
    });

    // All fields should come from the ORIGINAL user
    expect(result.id).toBe("original-user-id");
    expect(result.username).toBe("alice");
    expect(result.displayName).toBe("Alice Original");
    expect(result.bio).toBe("My bio");
    expect(result.avatar).toBe("/alice-avatar.png");
    expect(result.tier).toBe("pro");
    expect(result.isEmailVerified).toBe(true);
    expect(result.linkedAccounts).toEqual(linkedAccounts);
  });

  it("cleans up cookie even if linking throws an error", async () => {
    const { linkUsersInGroup } = await import("@/lib/account-linking-db");
    const { prisma: mockP } = await import("@/lib/prisma");

    mockCookieGet.mockReturnValue({ value: "original-user-id" });

    // DB lookup succeeds but linkUsersInGroup throws
    vi.mocked(mockP.user.findUnique).mockResolvedValue({
      id: "original-user-id",
      username: "alice",
      displayName: "Alice",
      bio: null,
      avatar: null,
      tier: "free",
      emailVerified: null,
    } as never);

    vi.mocked(linkUsersInGroup).mockRejectedValue(new Error("DB error"));

    const token = {} as Record<string, unknown>;
    // Should not throw — errors are caught
    await jwtCallback({
      token,
      user: {
        id: "oauth-user-id",
        username: "bob",
        displayName: "Bob",
        bio: null,
        avatar: null,
        tier: "free",
      },
      account: { provider: "google", providerAccountId: "google-123" },
      profile: {},
      trigger: "signIn",
    });

    // Cookie should still be cleaned up
    expect(mockCookieDelete).toHaveBeenCalledWith("linkFromUserId");
  });
});
