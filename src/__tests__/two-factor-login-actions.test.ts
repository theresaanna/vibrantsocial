import { describe, it, expect, vi, beforeEach } from "vitest";

// --------------------------------------------------------------------------
// Mocks
// --------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: vi.fn(() => "127.0.0.1"),
  })),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    webAuthnCredential: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/two-factor", () => ({
  decryptSecret: vi.fn((s: string) => s.replace("encrypted:", "")),
  verifyTOTPCode: vi.fn(),
  verifyBackupCode: vi.fn(),
}));

vi.mock("@simplewebauthn/server", () => ({
  generateAuthenticationOptions: vi.fn(async () => ({
    challenge: "auth-challenge",
    rpId: "localhost",
    allowCredentials: [],
    timeout: 60000,
    userVerification: "preferred",
  })),
  verifyAuthenticationResponse: vi.fn(),
}));

// --------------------------------------------------------------------------
// Imports
// --------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { verifyTOTPCode, verifyBackupCode } from "@/lib/two-factor";
import { createPendingTwoFactorToken } from "@/lib/two-factor-pending";
import {
  verifyTwoFactorLogin,
  verifyBackupCodeLogin,
  hasPasskeysForPending,
} from "@/app/login/two-factor/actions";

const mockPrisma = vi.mocked(prisma);
const mockSignIn = vi.mocked(signIn);
const mockVerifyTOTP = vi.mocked(verifyTOTPCode);
const mockVerifyBackup = vi.mocked(verifyBackupCode);

describe("createPendingTwoFactorToken", () => {
  it("creates a token that can be referenced", () => {
    const token = createPendingTwoFactorToken("user1", "user@example.com");
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    // UUID format
    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("generates unique tokens for same user", () => {
    const t1 = createPendingTwoFactorToken("user1", "user@example.com");
    const t2 = createPendingTwoFactorToken("user1", "user@example.com");
    expect(t1).not.toBe(t2);
  });
});

describe("verifyTwoFactorLogin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects empty token", async () => {
    const result = await verifyTwoFactorLogin("", "123456");
    expect(result.success).toBe(false);
    expect(result.message).toContain("expired");
  });

  it("rejects invalid token", async () => {
    const result = await verifyTwoFactorLogin("bogus-token", "123456");
    expect(result.success).toBe(false);
    expect(result.message).toContain("expired");
  });

  it("rejects non-6-digit code", async () => {
    const token = createPendingTwoFactorToken("user1", "user@example.com");
    const result = await verifyTwoFactorLogin(token, "abc");
    expect(result.success).toBe(false);
    expect(result.message).toContain("6-digit");
  });

  it("rejects if user has no 2FA secret", async () => {
    const token = createPendingTwoFactorToken("user1", "user@example.com");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      twoFactorSecret: null,
      twoFactorEnabled: false,
    } as never);

    const result = await verifyTwoFactorLogin(token, "123456");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not configured");
  });

  it("rejects incorrect TOTP code", async () => {
    const token = createPendingTwoFactorToken("user1", "user@example.com");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      twoFactorSecret: "encrypted:SECRET",
      twoFactorEnabled: true,
    } as never);
    mockVerifyTOTP.mockReturnValueOnce(false);

    const result = await verifyTwoFactorLogin(token, "999999");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid code");
  });

  it("signs in on valid TOTP code", async () => {
    const token = createPendingTwoFactorToken("user1", "user@example.com");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      twoFactorSecret: "encrypted:SECRET",
      twoFactorEnabled: true,
    } as never);
    mockVerifyTOTP.mockReturnValueOnce(true);
    mockSignIn.mockResolvedValueOnce(undefined as never);

    const result = await verifyTwoFactorLogin(token, "123456");
    expect(result.success).toBe(true);
    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "user@example.com",
      password: "__2fa_verified__",
      redirectTo: "/complete-profile",
      __twoFactorBypass: "true",
    });
  });

  it("consumes token after successful verification (prevents replay)", async () => {
    const token = createPendingTwoFactorToken("user1", "user@example.com");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      twoFactorSecret: "encrypted:SECRET",
      twoFactorEnabled: true,
    } as never);
    mockVerifyTOTP.mockReturnValueOnce(true);
    mockSignIn.mockResolvedValueOnce(undefined as never);

    await verifyTwoFactorLogin(token, "123456");

    // Second attempt with same token should fail
    const result2 = await verifyTwoFactorLogin(token, "123456");
    expect(result2.success).toBe(false);
    expect(result2.message).toContain("expired");
  });
});

describe("verifyBackupCodeLogin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects empty token", async () => {
    const result = await verifyBackupCodeLogin("", "abcd-efgh");
    expect(result.success).toBe(false);
  });

  it("rejects empty backup code", async () => {
    const token = createPendingTwoFactorToken("user1", "user@example.com");
    const result = await verifyBackupCodeLogin(token, "");
    expect(result.success).toBe(false);
    expect(result.message).toContain("backup code");
  });

  it("rejects invalid backup code", async () => {
    const token = createPendingTwoFactorToken("user1", "user@example.com");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      twoFactorEnabled: true,
      twoFactorBackupCodes: ["hashed1", "hashed2"],
    } as never);
    mockVerifyBackup.mockResolvedValueOnce(-1);

    const result = await verifyBackupCodeLogin(token, "wrong-code");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid backup code");
  });

  it("accepts valid backup code and removes it", async () => {
    const token = createPendingTwoFactorToken("user1", "user@example.com");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      twoFactorEnabled: true,
      twoFactorBackupCodes: ["hash0", "hash1", "hash2"],
    } as never);
    mockVerifyBackup.mockResolvedValueOnce(1); // matches index 1
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockSignIn.mockResolvedValueOnce(undefined as never);

    const result = await verifyBackupCodeLogin(token, "cccc-dddd");
    expect(result.success).toBe(true);

    // Should remove the used code (index 1)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { twoFactorBackupCodes: ["hash0", "hash2"] },
    });
  });
});

describe("hasPasskeysForPending", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false for empty token", async () => {
    const result = await hasPasskeysForPending("");
    expect(result).toBe(false);
  });

  it("returns false when no passkeys", async () => {
    const token = createPendingTwoFactorToken("user1", "user@example.com");
    mockPrisma.webAuthnCredential.count.mockResolvedValueOnce(0);
    const result = await hasPasskeysForPending(token);
    expect(result).toBe(false);
  });

  it("returns true when passkeys exist", async () => {
    const token = createPendingTwoFactorToken("user1", "user@example.com");
    mockPrisma.webAuthnCredential.count.mockResolvedValueOnce(2);
    const result = await hasPasskeysForPending(token);
    expect(result).toBe(true);
  });
});
