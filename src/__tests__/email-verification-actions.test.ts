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
    verificationToken: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmailVerificationEmail: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: {
    userProfile: (username: string) => `profile:${username}`,
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailVerificationEmail } from "@/lib/email";
import {
  requestEmailChange,
  cancelEmailChange,
} from "@/app/profile/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockSendEmail = vi.mocked(sendEmailVerificationEmail);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };

describe("requestEmailChange", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await requestEmailChange(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if email is empty", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await requestEmailChange(
      prevState,
      makeFormData({ email: "" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Email is required");
  });

  it("returns error if email is missing from form data", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await requestEmailChange(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Email is required");
  });

  it("validates email format", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await requestEmailChange(
      prevState,
      makeFormData({ email: "notanemail" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email address");
  });

  it("validates email format - missing domain", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await requestEmailChange(
      prevState,
      makeFormData({ email: "user@" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email address");
  });

  it("validates email format - missing TLD", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await requestEmailChange(
      prevState,
      makeFormData({ email: "user@domain" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email address");
  });

  it("returns error if email is same as current", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "user@example.com",
    } as never);

    const result = await requestEmailChange(
      prevState,
      makeFormData({ email: "user@example.com" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("This is already your email address");
  });

  it("returns error if email is already used by another user", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // current user email check
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "old@example.com",
    } as never);
    // existing user with that email
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "other-user",
      email: "taken@example.com",
    } as never);

    const result = await requestEmailChange(
      prevState,
      makeFormData({ email: "taken@example.com" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "This email is already associated with another account"
    );
  });

  it("allows user to re-verify their own email", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // current user check returns different email
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "old@example.com",
    } as never);
    // same user has this email (edge case)
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      email: "new@example.com",
    } as never);
    mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({
      count: 0,
    } as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await requestEmailChange(
      prevState,
      makeFormData({ email: "new@example.com" })
    );
    expect(result.success).toBe(true);
  });

  it("successfully creates token, updates pendingEmail, and sends email", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // current user email
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "old@example.com",
    } as never);
    // no existing user with new email
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({
      count: 0,
    } as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await requestEmailChange(
      prevState,
      makeFormData({ email: "new@example.com" })
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe("Verification email sent! Check your inbox.");

    // Cleaned up old tokens
    expect(mockPrisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "email-verify:new@example.com" },
    });

    // Created new token
    expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith({
      data: {
        identifier: "email-verify:new@example.com",
        token: expect.any(String),
        expires: expect.any(Date),
      },
    });

    // Updated pendingEmail
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { pendingEmail: "new@example.com" },
    });

    // Sent email
    expect(mockSendEmail).toHaveBeenCalledWith({
      toEmail: "new@example.com",
      token: expect.any(String),
    });
  });

  it("normalizes email to lowercase and trims whitespace", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: null,
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({
      count: 0,
    } as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await requestEmailChange(
      prevState,
      makeFormData({ email: "  USER@EXAMPLE.COM  " })
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        identifier: "email-verify:user@example.com",
      }),
    });
    expect(mockSendEmail).toHaveBeenCalledWith({
      toEmail: "user@example.com",
      token: expect.any(String),
    });
  });

  it("creates token with 1 hour expiry", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: null,
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({
      count: 0,
    } as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const before = Date.now();
    await requestEmailChange(
      prevState,
      makeFormData({ email: "new@example.com" })
    );
    const after = Date.now();

    const createCall = mockPrisma.verificationToken.create.mock.calls[0][0];
    const expires = createCall.data.expires as Date;
    const expiresMs = expires.getTime();

    // Should be approximately 1 hour from now
    expect(expiresMs).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 100);
    expect(expiresMs).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 100);
  });

  it("works for user with no current email (OAuth user)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // No current email
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: null,
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({
      count: 0,
    } as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await requestEmailChange(
      prevState,
      makeFormData({ email: "newemail@example.com" })
    );
    expect(result.success).toBe(true);
  });
});

describe("cancelEmailChange", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await cancelEmailChange();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("clears pendingEmail and deletes tokens", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      pendingEmail: "pending@example.com",
    } as never);
    mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({
      count: 1,
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await cancelEmailChange();
    expect(result.success).toBe(true);
    expect(result.message).toBe("Email change cancelled");

    expect(mockPrisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "email-verify:pending@example.com" },
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { pendingEmail: null },
    });
  });

  it("returns success even if no pending email exists", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      pendingEmail: null,
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await cancelEmailChange();
    expect(result.success).toBe(true);
    // Should not try to delete tokens when no pending email
    expect(mockPrisma.verificationToken.deleteMany).not.toHaveBeenCalled();
  });
});
