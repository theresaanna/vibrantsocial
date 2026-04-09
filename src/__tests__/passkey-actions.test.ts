import { describe, it, expect, vi, beforeEach } from "vitest";

// --------------------------------------------------------------------------
// Mocks
// --------------------------------------------------------------------------

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    webAuthnCredential: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(async () => ({
    challenge: "test-challenge",
    rp: { name: "VibrantSocial", id: "localhost" },
    user: { id: "u1", name: "user@example.com", displayName: "User" },
    pubKeyCredParams: [],
    timeout: 60000,
    attestation: "none",
    excludeCredentials: [],
  })),
  verifyRegistrationResponse: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: { userProfile: (u: string) => `profile:${u}` },
}));

// --------------------------------------------------------------------------
// Imports
// --------------------------------------------------------------------------

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  listPasskeys,
  removePasskey,
  renamePasskey,
} from "@/app/profile/passkey-actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockVerifyReg = vi.mocked(verifyRegistrationResponse);

describe("generatePasskeyRegistrationOptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await generatePasskeyRegistrationOptions();
    expect(result.success).toBe(false);
  });

  it("requires 2FA to be enabled first", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "user@example.com",
      username: "testuser",
      displayName: "Test",
      twoFactorEnabled: false,
      webauthnCredentials: [],
    } as never);

    const result = await generatePasskeyRegistrationOptions();
    expect(result.success).toBe(false);
    expect(result.message).toContain("Enable two-factor");
  });

  it("returns registration options when 2FA is enabled", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "user@example.com",
      username: "testuser",
      displayName: "Test",
      twoFactorEnabled: true,
      webauthnCredentials: [],
    } as never);

    const result = await generatePasskeyRegistrationOptions();
    expect(result.success).toBe(true);
    expect(result.options).toBeDefined();
    expect(result.options?.challenge).toBe("test-challenge");
  });
});

describe("verifyPasskeyRegistration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await verifyPasskeyRegistration({} as never, "My Key");
    expect(result.success).toBe(false);
  });

  it("returns error if challenge expired", async () => {
    // Use a user ID that has no stored challenge
    mockAuth.mockResolvedValueOnce({ user: { id: "u-no-challenge" } } as never);
    const result = await verifyPasskeyRegistration({} as never, "My Key");
    expect(result.success).toBe(false);
    expect(result.message).toContain("expired");
  });
});

describe("listPasskeys", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await listPasskeys();
    expect(result).toEqual([]);
  });

  it("returns formatted passkey list", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.webAuthnCredential.findMany.mockResolvedValueOnce([
      {
        id: "cred1",
        name: "My MacBook",
        createdAt: new Date("2026-01-01"),
        lastUsedAt: new Date("2026-03-15"),
        deviceType: "multiDevice",
        backedUp: true,
      },
      {
        id: "cred2",
        name: null,
        createdAt: new Date("2026-02-01"),
        lastUsedAt: null,
        deviceType: "singleDevice",
        backedUp: false,
      },
    ] as never);

    const result = await listPasskeys();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "cred1",
      name: "My MacBook",
      createdAt: "2026-01-01T00:00:00.000Z",
      lastUsedAt: "2026-03-15T00:00:00.000Z",
      deviceType: "multiDevice",
      backedUp: true,
    });
    expect(result[1].name).toBeNull();
    expect(result[1].lastUsedAt).toBeNull();
  });
});

describe("removePasskey", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await removePasskey("cred1");
    expect(result.success).toBe(false);
  });

  it("requires credential ID", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await removePasskey("");
    expect(result.success).toBe(false);
    expect(result.message).toContain("required");
  });

  it("returns error if passkey not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.webAuthnCredential.findUnique.mockResolvedValueOnce(null);
    const result = await removePasskey("nonexistent");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("prevents removing another user's passkey", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.webAuthnCredential.findUnique.mockResolvedValueOnce({
      userId: "u2",
    } as never);
    const result = await removePasskey("cred1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("deletes the passkey on success", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.webAuthnCredential.findUnique.mockResolvedValueOnce({
      userId: "u1",
    } as never);
    mockPrisma.webAuthnCredential.delete.mockResolvedValueOnce({} as never);

    const result = await removePasskey("cred1");
    expect(result.success).toBe(true);
    expect(mockPrisma.webAuthnCredential.delete).toHaveBeenCalledWith({
      where: { id: "cred1" },
    });
  });
});

describe("renamePasskey", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await renamePasskey("cred1", "New Name");
    expect(result.success).toBe(false);
  });

  it("requires name", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await renamePasskey("cred1", "  ");
    expect(result.success).toBe(false);
    expect(result.message).toContain("required");
  });

  it("prevents renaming another user's passkey", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.webAuthnCredential.findUnique.mockResolvedValueOnce({
      userId: "u2",
    } as never);
    const result = await renamePasskey("cred1", "My Key");
    expect(result.success).toBe(false);
  });

  it("renames passkey and truncates long names", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.webAuthnCredential.findUnique.mockResolvedValueOnce({
      userId: "u1",
    } as never);
    mockPrisma.webAuthnCredential.update.mockResolvedValueOnce({} as never);

    const longName = "A".repeat(200);
    const result = await renamePasskey("cred1", longName);
    expect(result.success).toBe(true);
    expect(mockPrisma.webAuthnCredential.update).toHaveBeenCalledWith({
      where: { id: "cred1" },
      data: { name: "A".repeat(100) },
    });
  });
});
