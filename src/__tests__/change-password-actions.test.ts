import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("new_hashed_password"),
  },
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: {
    userProfile: (username: string) => `profile:${username}`,
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { changePassword } from "@/app/profile/actions";

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
const validForm = {
  currentPassword: "OldPass123!",
  newPassword: "NewPass456!",
  confirmNewPassword: "NewPass456!",
};

describe("changePassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await changePassword(prevState, makeFormData(validForm));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if current password is empty", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await changePassword(
      prevState,
      makeFormData({ ...validForm, currentPassword: "" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Current password is required");
  });

  it("returns error if new password is too short", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await changePassword(
      prevState,
      makeFormData({ ...validForm, newPassword: "short", confirmNewPassword: "short" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Password must be at least 8 characters");
  });

  it("returns error if new password matches current password", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await changePassword(
      prevState,
      makeFormData({
        currentPassword: "SamePass123!",
        newPassword: "SamePass123!",
        confirmNewPassword: "SamePass123!",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "New password must be different from current password"
    );
  });

  it("returns error if passwords do not match", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await changePassword(
      prevState,
      makeFormData({
        ...validForm,
        confirmNewPassword: "Mismatch999!",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Passwords do not match");
  });

  it("returns error for OAuth-only account (no passwordHash)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      passwordHash: null,
    } as never);
    const result = await changePassword(prevState, makeFormData(validForm));
    expect(result.success).toBe(false);
    expect(result.message).toContain("social login");
  });

  it("returns error if current password is incorrect", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      passwordHash: "existing_hash",
    } as never);
    mockBcrypt.compare.mockResolvedValueOnce(false as never);

    const result = await changePassword(prevState, makeFormData(validForm));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Current password is incorrect");
    expect(mockBcrypt.compare).toHaveBeenCalledWith("OldPass123!", "existing_hash");
  });

  it("updates password on success", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      passwordHash: "existing_hash",
    } as never);
    mockBcrypt.compare.mockResolvedValueOnce(true as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await changePassword(prevState, makeFormData(validForm));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Password changed successfully");
    expect(mockBcrypt.hash).toHaveBeenCalledWith("NewPass456!", 12);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: "new_hashed_password" },
    });
  });
});
