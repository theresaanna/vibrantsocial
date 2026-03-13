import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationToken: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
  },
}));

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { resetPassword } from "@/app/reset-password/actions";

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

describe("resetPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when token is missing", async () => {
    const result = await resetPassword(
      prevState,
      makeFormData({ email: "user@example.com", password: "newpass123", confirmPassword: "newpass123" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid reset link");
  });

  it("returns error when email is missing", async () => {
    const result = await resetPassword(
      prevState,
      makeFormData({ token: "tok123", password: "newpass123", confirmPassword: "newpass123" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid reset link");
  });

  it("returns error when password is too short", async () => {
    const result = await resetPassword(
      prevState,
      makeFormData({
        token: "tok123",
        email: "user@example.com",
        password: "short",
        confirmPassword: "short",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Password must be at least 8 characters");
  });

  it("returns error when password is empty", async () => {
    const result = await resetPassword(
      prevState,
      makeFormData({
        token: "tok123",
        email: "user@example.com",
        password: "",
        confirmPassword: "",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Password must be at least 8 characters");
  });

  it("returns error when passwords do not match", async () => {
    const result = await resetPassword(
      prevState,
      makeFormData({
        token: "tok123",
        email: "user@example.com",
        password: "newpass123",
        confirmPassword: "different123",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Passwords do not match");
  });

  it("returns error when verification token not found", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(null as never);

    const result = await resetPassword(
      prevState,
      makeFormData({
        token: "invalid-token",
        email: "user@example.com",
        password: "newpass123",
        confirmPassword: "newpass123",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "Invalid or expired reset link. Please request a new one."
    );
  });

  it("returns error and deletes token when expired", async () => {
    const expiredDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "user@example.com",
      token: "tok123",
      expires: expiredDate,
    } as never);
    mockPrisma.verificationToken.delete.mockResolvedValueOnce({} as never);

    const result = await resetPassword(
      prevState,
      makeFormData({
        token: "tok123",
        email: "user@example.com",
        password: "newpass123",
        confirmPassword: "newpass123",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "This reset link has expired. Please request a new one."
    );
    expect(mockPrisma.verificationToken.delete).toHaveBeenCalledWith({
      where: {
        identifier_token: {
          identifier: "user@example.com",
          token: "tok123",
        },
      },
    });
  });

  it("returns error when user not found by email", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "user@example.com",
      token: "tok123",
      expires: futureDate,
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await resetPassword(
      prevState,
      makeFormData({
        token: "tok123",
        email: "user@example.com",
        password: "newpass123",
        confirmPassword: "newpass123",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "Invalid or expired reset link. Please request a new one."
    );
  });

  it("resets password successfully", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "user@example.com",
      token: "tok123",
      expires: futureDate,
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      email: "user@example.com",
    } as never);
    mockBcrypt.hash.mockResolvedValueOnce("hashed_new_password" as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockPrisma.verificationToken.delete.mockResolvedValueOnce({} as never);

    const result = await resetPassword(
      prevState,
      makeFormData({
        token: "tok123",
        email: "User@Example.COM",
        password: "newpass123",
        confirmPassword: "newpass123",
      })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe(
      "Password reset successfully! You can now sign in."
    );
    expect(mockBcrypt.hash).toHaveBeenCalledWith("newpass123", 12);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { passwordHash: "hashed_new_password" },
    });
    expect(mockPrisma.verificationToken.delete).toHaveBeenCalledWith({
      where: {
        identifier_token: {
          identifier: "user@example.com",
          token: "tok123",
        },
      },
    });
  });
});
