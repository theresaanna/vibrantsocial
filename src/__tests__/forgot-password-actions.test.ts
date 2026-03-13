import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { requestPasswordReset } from "@/app/forgot-password/actions";

const mockPrisma = vi.mocked(prisma);
const mockSendEmail = vi.mocked(sendPasswordResetEmail);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };
const successMessage =
  "If an account with that email exists, we sent you a reset link.";

describe("requestPasswordReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when email is empty", async () => {
    const result = await requestPasswordReset(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Email is required");
  });

  it("returns error when email is whitespace-only", async () => {
    const result = await requestPasswordReset(
      prevState,
      makeFormData({ email: "   " })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Email is required");
  });

  it("returns error for invalid email format", async () => {
    const result = await requestPasswordReset(
      prevState,
      makeFormData({ email: "not-an-email" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email address");
  });

  it("returns success when user not found (to prevent email enumeration)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await requestPasswordReset(
      prevState,
      makeFormData({ email: "unknown@example.com" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe(successMessage);
    expect(mockPrisma.verificationToken.create).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns success when user has no password (OAuth-only)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      email: "oauth@example.com",
      passwordHash: null,
    } as never);

    const result = await requestPasswordReset(
      prevState,
      makeFormData({ email: "oauth@example.com" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe(successMessage);
    expect(mockPrisma.verificationToken.create).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("creates token and sends email when user exists with password", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      email: "user@example.com",
      passwordHash: "hashed",
    } as never);
    mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({
      count: 0,
    } as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);

    const result = await requestPasswordReset(
      prevState,
      makeFormData({ email: "User@Example.COM" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe(successMessage);

    // Should clean up existing tokens
    expect(mockPrisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "user@example.com" },
    });

    // Should create a new token
    expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith({
      data: {
        identifier: "user@example.com",
        token: expect.any(String),
        expires: expect.any(Date),
      },
    });

    // Should send email
    expect(mockSendEmail).toHaveBeenCalledWith({
      toEmail: "user@example.com",
      token: expect.any(String),
    });
  });

  it("lowercases and trims email", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    await requestPasswordReset(
      prevState,
      makeFormData({ email: "  USER@EXAMPLE.COM  " })
    );
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
  });
});
