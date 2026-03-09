import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    verificationToken: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { verifyEmail } from "@/app/verify-email/actions";

const mockPrisma = vi.mocked(prisma);

describe("verifyEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if token is empty", async () => {
    const result = await verifyEmail("", "user@example.com");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid verification link.");
  });

  it("returns error if email is empty", async () => {
    const result = await verifyEmail("some-token", "");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid verification link.");
  });

  it("returns error for invalid token (not found)", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(
      null as never
    );

    const result = await verifyEmail("bad-token", "user@example.com");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid or expired verification link.");
    expect(mockPrisma.verificationToken.findUnique).toHaveBeenCalledWith({
      where: {
        identifier_token: {
          identifier: "email-verify:user@example.com",
          token: "bad-token",
        },
      },
    });
  });

  it("returns error for expired token and cleans it up", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "email-verify:user@example.com",
      token: "expired-token",
      expires: new Date(Date.now() - 1000),
    } as never);
    mockPrisma.verificationToken.delete.mockResolvedValueOnce({} as never);

    const result = await verifyEmail("expired-token", "user@example.com");
    expect(result.success).toBe(false);
    expect(result.message).toContain("expired");
    expect(mockPrisma.verificationToken.delete).toHaveBeenCalledWith({
      where: {
        identifier_token: {
          identifier: "email-verify:user@example.com",
          token: "expired-token",
        },
      },
    });
  });

  it("returns error if no user with matching pendingEmail", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "email-verify:user@example.com",
      token: "valid-token",
      expires: new Date(Date.now() + 3600000),
    } as never);
    mockPrisma.user.findFirst.mockResolvedValueOnce(null as never);
    mockPrisma.verificationToken.delete.mockResolvedValueOnce({} as never);

    const result = await verifyEmail("valid-token", "user@example.com");
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "No pending email change found for this address."
    );
  });

  it("returns error if email was taken by another user (race condition)", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "email-verify:user@example.com",
      token: "valid-token",
      expires: new Date(Date.now() + 3600000),
    } as never);
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: "user1",
      pendingEmail: "user@example.com",
    } as never);
    // Another user now has this email
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "other-user",
      email: "user@example.com",
    } as never);
    mockPrisma.verificationToken.delete.mockResolvedValueOnce({} as never);

    const result = await verifyEmail("valid-token", "user@example.com");
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "This email address is no longer available."
    );
  });

  it("successfully verifies email", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "email-verify:new@example.com",
      token: "valid-token",
      expires: new Date(Date.now() + 3600000),
    } as never);
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: "user1",
      pendingEmail: "new@example.com",
    } as never);
    // No one else has this email
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockPrisma.verificationToken.delete.mockResolvedValueOnce({} as never);

    const result = await verifyEmail("valid-token", "new@example.com");
    expect(result.success).toBe(true);
    expect(result.message).toBe("Your email address has been verified!");

    // Updated user email
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: {
        email: "new@example.com",
        emailVerified: expect.any(Date),
        pendingEmail: null,
      },
    });

    // Deleted token
    expect(mockPrisma.verificationToken.delete).toHaveBeenCalledWith({
      where: {
        identifier_token: {
          identifier: "email-verify:new@example.com",
          token: "valid-token",
        },
      },
    });
  });

  it("allows same user to verify (not blocked by own email)", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "email-verify:user@example.com",
      token: "valid-token",
      expires: new Date(Date.now() + 3600000),
    } as never);
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: "user1",
      pendingEmail: "user@example.com",
    } as never);
    // Same user already has this email (re-verification scenario)
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      email: "user@example.com",
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockPrisma.verificationToken.delete.mockResolvedValueOnce({} as never);

    const result = await verifyEmail("valid-token", "user@example.com");
    expect(result.success).toBe(true);
  });

  it("normalizes email to lowercase", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "email-verify:user@example.com",
      token: "valid-token",
      expires: new Date(Date.now() + 3600000),
    } as never);
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: "user1",
      pendingEmail: "user@example.com",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockPrisma.verificationToken.delete.mockResolvedValueOnce({} as never);

    const result = await verifyEmail("valid-token", "  USER@EXAMPLE.COM  ");
    expect(result.success).toBe(true);

    // Should have looked up with normalized email
    expect(mockPrisma.verificationToken.findUnique).toHaveBeenCalledWith({
      where: {
        identifier_token: {
          identifier: "email-verify:user@example.com",
          token: "valid-token",
        },
      },
    });
  });
});
