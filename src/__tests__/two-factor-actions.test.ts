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
      update: vi.fn(),
    },
    webAuthnCredential: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/two-factor", () => ({
  generateTOTPSecret: vi.fn(() => "TESTBASE32SECRET"),
  getTOTPUri: vi.fn(() => "otpauth://totp/VibrantSocial:user@example.com?secret=TESTBASE32SECRET"),
  encryptSecret: vi.fn((s: string) => `encrypted:${s}`),
  decryptSecret: vi.fn((s: string) => s.replace("encrypted:", "")),
  verifyTOTPCode: vi.fn(),
  generateBackupCodes: vi.fn(() => ["aaaa-bbbb", "cccc-dddd", "eeee-ffff"]),
  hashBackupCodes: vi.fn(async (codes: string[]) => codes.map((c) => `hashed:${c}`)),
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
import { verifyTOTPCode } from "@/lib/two-factor";
import {
  beginTOTPSetup,
  confirmTOTPSetup,
  disableTwoFactor,
  regenerateBackupCodes,
} from "@/app/profile/two-factor-actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockVerifyTOTP = vi.mocked(verifyTOTPCode);

describe("beginTOTPSetup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await beginTOTPSetup();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error for OAuth-only accounts", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "user@example.com",
      passwordHash: null,
      twoFactorEnabled: false,
    } as never);
    const result = await beginTOTPSetup();
    expect(result.success).toBe(false);
    expect(result.message).toContain("password-based account");
  });

  it("returns error if 2FA already enabled", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "user@example.com",
      passwordHash: "hash",
      twoFactorEnabled: true,
    } as never);
    const result = await beginTOTPSetup();
    expect(result.success).toBe(false);
    expect(result.message).toContain("already enabled");
  });

  it("returns secret and URI on success", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "user@example.com",
      passwordHash: "hash",
      twoFactorEnabled: false,
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await beginTOTPSetup();
    expect(result.success).toBe(true);
    expect(result.secret).toBe("TESTBASE32SECRET");
    expect(result.uri).toContain("otpauth://totp/");
  });

  it("stores encrypted secret in database", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "user@example.com",
      passwordHash: "hash",
      twoFactorEnabled: false,
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    await beginTOTPSetup();
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { twoFactorSecret: "encrypted:TESTBASE32SECRET" },
    });
  });
});

describe("confirmTOTPSetup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await confirmTOTPSetup("123456");
    expect(result.success).toBe(false);
  });

  it("rejects invalid code format", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await confirmTOTPSetup("abc");
    expect(result.success).toBe(false);
    expect(result.message).toContain("6-digit");
  });

  it("returns error if no pending secret", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      twoFactorSecret: null,
      twoFactorEnabled: false,
    } as never);
    const result = await confirmTOTPSetup("123456");
    expect(result.success).toBe(false);
    expect(result.message).toContain("start again");
  });

  it("returns error if already enabled", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      twoFactorSecret: "encrypted:SECRET",
      twoFactorEnabled: true,
    } as never);
    const result = await confirmTOTPSetup("123456");
    expect(result.success).toBe(false);
    expect(result.message).toContain("already enabled");
  });

  it("rejects incorrect TOTP code", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      twoFactorSecret: "encrypted:SECRET",
      twoFactorEnabled: false,
    } as never);
    mockVerifyTOTP.mockReturnValueOnce(false);

    const result = await confirmTOTPSetup("999999");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid code");
  });

  it("enables 2FA and returns backup codes on valid code", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      twoFactorSecret: "encrypted:SECRET",
      twoFactorEnabled: false,
    } as never);
    mockVerifyTOTP.mockReturnValueOnce(true);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await confirmTOTPSetup("123456");
    expect(result.success).toBe(true);
    expect(result.backupCodes).toEqual(["aaaa-bbbb", "cccc-dddd", "eeee-ffff"]);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: expect.arrayContaining([expect.stringContaining("hashed:")]),
      },
    });
  });
});

describe("disableTwoFactor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await disableTwoFactor("password");
    expect(result.success).toBe(false);
  });

  it("requires password", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await disableTwoFactor("");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Password is required");
  });

  it("rejects incorrect password", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      passwordHash: "$2a$12$invalidhashthatshouldnotmatch",
      twoFactorEnabled: true,
    } as never);
    const result = await disableTwoFactor("wrongpassword");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Incorrect password");
  });

  it("returns error if 2FA not enabled", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      passwordHash: "hash",
      twoFactorEnabled: false,
    } as never);
    const result = await disableTwoFactor("password");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not enabled");
  });

  it("disables 2FA and clears data on valid password", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("correctpassword", 4);

    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      passwordHash: hash,
      twoFactorEnabled: true,
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockPrisma.webAuthnCredential.deleteMany.mockResolvedValueOnce({} as never);

    const result = await disableTwoFactor("correctpassword");
    expect(result.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });
    // Should also delete passkeys
    expect(mockPrisma.webAuthnCredential.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });
});

describe("regenerateBackupCodes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await regenerateBackupCodes("pass");
    expect(result.success).toBe(false);
  });

  it("requires password", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await regenerateBackupCodes("");
    expect(result.success).toBe(false);
  });

  it("returns error if 2FA not enabled", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      passwordHash: "hash",
      twoFactorEnabled: false,
    } as never);
    const result = await regenerateBackupCodes("pass");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not enabled");
  });

  it("generates new codes on valid password", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("correctpassword", 4);

    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      passwordHash: hash,
      twoFactorEnabled: true,
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await regenerateBackupCodes("correctpassword");
    expect(result.success).toBe(true);
    expect(result.backupCodes).toHaveLength(3);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        twoFactorBackupCodes: expect.any(Array),
      },
    });
  });
});
