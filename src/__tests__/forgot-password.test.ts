import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    verificationToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("new_hashed_password"),
  },
}));

import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { requestPasswordReset } from "@/app/forgot-password/actions";
import { resetPassword } from "@/app/reset-password/actions";

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

describe("requestPasswordReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires email", async () => {
    const result = await requestPasswordReset(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Email is required");
  });

  it("validates email format", async () => {
    const result = await requestPasswordReset(
      prevState,
      makeFormData({ email: "notanemail" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email address");
  });

  it("returns success even if user not found (anti-enumeration)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await requestPasswordReset(
      prevState,
      makeFormData({ email: "nobody@example.com" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("If an account");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns success for OAuth-only user without sending email", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "oauth@example.com",
      passwordHash: null,
    } as never);

    const result = await requestPasswordReset(
      prevState,
      makeFormData({ email: "oauth@example.com" })
    );
    expect(result.success).toBe(true);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("creates token and sends email for valid credentials user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "user@example.com",
      passwordHash: "hashed",
    } as never);
    mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({
      count: 0,
    } as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);

    const result = await requestPasswordReset(
      prevState,
      makeFormData({ email: "user@example.com" })
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "user@example.com" },
    });
    expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith({
      data: {
        identifier: "user@example.com",
        token: expect.any(String),
        expires: expect.any(Date),
      },
    });
    expect(mockSendEmail).toHaveBeenCalledWith({
      toEmail: "user@example.com",
      token: expect.any(String),
    });
  });

  it("normalizes email to lowercase", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    await requestPasswordReset(
      prevState,
      makeFormData({ email: "USER@EXAMPLE.COM" })
    );

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
  });
});

describe("resetPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires token and email", async () => {
    const result = await resetPassword(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid reset link");
  });

  it("validates password minimum length", async () => {
    const result = await resetPassword(
      prevState,
      makeFormData({
        token: "tok",
        email: "user@example.com",
        password: "short",
        confirmPassword: "short",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Password must be at least 8 characters");
  });

  it("requires passwords to match", async () => {
    const result = await resetPassword(
      prevState,
      makeFormData({
        token: "tok",
        email: "user@example.com",
        password: "password123",
        confirmPassword: "password456",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Passwords do not match");
  });

  it("returns error for invalid token", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(
      null as never
    );

    const result = await resetPassword(
      prevState,
      makeFormData({
        token: "bad-token",
        email: "user@example.com",
        password: "password123",
        confirmPassword: "password123",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid or expired");
  });

  it("returns error for expired token and cleans it up", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "user@example.com",
      token: "expired-tok",
      expires: new Date(Date.now() - 1000),
    } as never);
    mockPrisma.verificationToken.delete.mockResolvedValueOnce({} as never);

    const result = await resetPassword(
      prevState,
      makeFormData({
        token: "expired-tok",
        email: "user@example.com",
        password: "password123",
        confirmPassword: "password123",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("expired");
    expect(mockPrisma.verificationToken.delete).toHaveBeenCalled();
  });

  it("returns error if user not found", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "user@example.com",
      token: "valid-tok",
      expires: new Date(Date.now() + 3600000),
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await resetPassword(
      prevState,
      makeFormData({
        token: "valid-tok",
        email: "user@example.com",
        password: "password123",
        confirmPassword: "password123",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid or expired");
  });

  it("resets password successfully", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "user@example.com",
      token: "valid-tok",
      expires: new Date(Date.now() + 3600000),
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "user@example.com",
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockPrisma.verificationToken.delete.mockResolvedValueOnce({} as never);

    const result = await resetPassword(
      prevState,
      makeFormData({
        token: "valid-tok",
        email: "user@example.com",
        password: "newpassword123",
        confirmPassword: "newpassword123",
      })
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("Password reset successfully");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: "new_hashed_password" },
    });
    expect(mockPrisma.verificationToken.delete).toHaveBeenCalled();
  });
});
