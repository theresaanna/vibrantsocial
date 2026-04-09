import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    verificationToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const mockSendPasswordResetEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmailVerificationEmail: vi.fn(),
  sendPasswordResetEmail: (...args: unknown[]) =>
    mockSendPasswordResetEmail(...args),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: {
    userProfile: (username: string) => `profile:${username}`,
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requestPasswordChangeEmail } from "@/app/profile/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

describe("requestPasswordChangeEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await requestPasswordChangeEmail();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if user has no email", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: null,
      passwordHash: "hash",
    } as never);
    const result = await requestPasswordChangeEmail();
    expect(result.success).toBe(false);
    expect(result.message).toBe("No email address on file");
  });

  it("returns error for OAuth-only account (no passwordHash)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "user@example.com",
      passwordHash: null,
    } as never);
    const result = await requestPasswordChangeEmail();
    expect(result.success).toBe(false);
    expect(result.message).toContain("social login");
  });

  it("cleans up existing tokens and sends reset email on success", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "user@example.com",
      passwordHash: "existing_hash",
    } as never);
    mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({} as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);

    const result = await requestPasswordChangeEmail();

    expect(result.success).toBe(true);
    expect(result.message).toContain("reset link sent");
    expect(mockPrisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "user@example.com" },
    });
    expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        identifier: "user@example.com",
        token: expect.any(String),
        expires: expect.any(Date),
      }),
    });
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith({
      toEmail: "user@example.com",
      token: expect.any(String),
    });
  });

  it("creates token with 1-hour expiry", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "user@example.com",
      passwordHash: "existing_hash",
    } as never);
    mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({} as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);

    const before = Date.now();
    await requestPasswordChangeEmail();
    const after = Date.now();

    const createCall = mockPrisma.verificationToken.create.mock.calls[0][0];
    const expires = (createCall.data as { expires: Date }).expires.getTime();
    // Token should expire ~1 hour from now (within a few seconds tolerance)
    expect(expires).toBeGreaterThanOrEqual(before + 59 * 60 * 1000);
    expect(expires).toBeLessThanOrEqual(after + 61 * 60 * 1000);
  });
});
