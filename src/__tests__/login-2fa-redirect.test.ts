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
  signIn: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: vi.fn(() => true),
}));

vi.mock("@/lib/validations", () => ({
  loginSchema: {},
  parseFormData: vi.fn(() => ({
    success: true,
    data: {
      email: "user@example.com",
      password: "password123",
      "cf-turnstile-response": "token",
    },
  })),
}));

const mockCreateToken = vi.fn(() => "pending-token-123");
vi.mock("@/lib/two-factor-pending", () => ({
  createPendingTwoFactorToken: (...args: unknown[]) => mockCreateToken(...args),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: { userProfile: (u: string) => `profile:${u}` },
}));

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { loginWithCredentials } from "@/app/login/actions";
import bcrypt from "bcryptjs";

const mockRedirect = vi.mocked(redirect);

// Make redirect throw like real Next.js does, so execution stops
class RedirectError extends Error {
  digest = "NEXT_REDIRECT";
  constructor(url: string) {
    super(`NEXT_REDIRECT: ${url}`);
  }
}
beforeEach(() => {
  mockRedirect.mockImplementation((url: string) => {
    throw new RedirectError(url);
  });
});

const mockPrisma = vi.mocked(prisma);
const mockSignIn = vi.mocked(signIn);

describe("loginWithCredentials - 2FA redirect", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeFormData(): FormData {
    const fd = new FormData();
    fd.set("email", "user@example.com");
    fd.set("password", "password123");
    fd.set("cf-turnstile-response", "token");
    return fd;
  }

  it("redirects to 2FA page when user has 2FA enabled", async () => {
    const hash = await bcrypt.hash("password123", 4);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      passwordHash: hash,
      twoFactorEnabled: true,
      suspended: false,
    } as never);

    // redirect() throws NEXT_REDIRECT in real Next.js, which loginWithCredentials re-throws
    await expect(
      loginWithCredentials({ success: false, message: "" }, makeFormData())
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("/login/two-factor?token=")
    );
    expect(mockCreateToken).toHaveBeenCalledWith("user1", "user@example.com");
    // Should NOT call signIn
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("proceeds to normal signIn when user has no 2FA", async () => {
    const hash = await bcrypt.hash("password123", 4);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      passwordHash: hash,
      twoFactorEnabled: false,
      suspended: false,
    } as never);
    mockSignIn.mockResolvedValueOnce(undefined as never);

    const result = await loginWithCredentials(
      { success: false, message: "" },
      makeFormData()
    );

    expect(result.success).toBe(true);
    expect(mockSignIn).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("rejects wrong password even when 2FA is enabled", async () => {
    const hash = await bcrypt.hash("correctpassword", 4);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      passwordHash: hash,
      twoFactorEnabled: true,
      suspended: false,
    } as never);

    const result = await loginWithCredentials(
      { success: false, message: "" },
      makeFormData() // Contains "password123", not "correctpassword"
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid email or password");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("does not reveal 2FA status for nonexistent accounts", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const { AuthError } = await import("next-auth");
    mockSignIn.mockRejectedValueOnce(
      Object.assign(new AuthError("CredentialsSignin"), { type: "CredentialsSignin" })
    );

    const result = await loginWithCredentials(
      { success: false, message: "" },
      makeFormData()
    );

    // Should show generic error, not "user not found" or "2FA required"
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email or password");
  });
});
