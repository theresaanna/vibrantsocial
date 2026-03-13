import { describe, it, expect, vi, beforeEach } from "vitest";
import { completeProfile } from "@/app/complete-profile/actions";

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
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmailVerificationEmail: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailVerificationEmail } from "@/lib/email";
import { redirect } from "next/navigation";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockSendEmail = vi.mocked(sendEmailVerificationEmail);
const mockRedirect = vi.mocked(redirect);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

function validDob(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 20);
  return d.toISOString().split("T")[0];
}

const prevState = { success: false, message: "" };

describe("completeProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await completeProfile(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  // --- Username validation ---

  it("returns error if username is required but missing from form", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: null,
      email: "existing@example.com",
      dateOfBirth: new Date("2000-01-01"),
    } as never);

    const result = await completeProfile(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Username is required");
  });

  it("returns error if username format is invalid", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: null,
      email: "existing@example.com",
      dateOfBirth: new Date("2000-01-01"),
    } as never);

    const result = await completeProfile(
      prevState,
      makeFormData({ username: "ab" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "Username must be 3-30 characters, letters, numbers, and underscores only"
    );
  });

  it("returns error if username is taken", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // Current user lookup
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: null,
      email: "existing@example.com",
      dateOfBirth: new Date("2000-01-01"),
    } as never);
    // Username uniqueness check
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "other-user",
    } as never);

    const result = await completeProfile(
      prevState,
      makeFormData({ username: "taken_user" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("This username is already taken");
  });

  // --- Email validation ---

  it("returns error if email is required but missing from form", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "existinguser",
      email: null,
      dateOfBirth: new Date("2000-01-01"),
    } as never);

    const result = await completeProfile(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Email is required");
  });

  it("returns error if email format is invalid", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "existinguser",
      email: null,
      dateOfBirth: new Date("2000-01-01"),
    } as never);

    const result = await completeProfile(
      prevState,
      makeFormData({ email: "notanemail" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email address");
  });

  it("returns error if email is taken by another user", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // Current user lookup
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "existinguser",
      email: null,
      dateOfBirth: new Date("2000-01-01"),
    } as never);
    // Email uniqueness check
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "other-user",
    } as never);

    const result = await completeProfile(
      prevState,
      makeFormData({ email: "taken@example.com" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "This email is already associated with another account"
    );
  });

  // --- Date of birth validation ---

  it("returns error if dateOfBirth is required but missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "existinguser",
      email: "existing@example.com",
      dateOfBirth: null,
    } as never);

    const result = await completeProfile(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Date of birth is required");
  });

  it("returns error for invalid date", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "existinguser",
      email: "existing@example.com",
      dateOfBirth: null,
    } as never);

    const result = await completeProfile(
      prevState,
      makeFormData({ dateOfBirth: "not-a-date" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid date of birth");
  });

  it("returns error for future date", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "existinguser",
      email: "existing@example.com",
      dateOfBirth: null,
    } as never);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await completeProfile(
      prevState,
      makeFormData({ dateOfBirth: tomorrow.toISOString().split("T")[0] })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Date of birth cannot be in the future");
  });

  it("returns error if under 18", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "existinguser",
      email: "existing@example.com",
      dateOfBirth: null,
    } as never);

    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

    const result = await completeProfile(
      prevState,
      makeFormData({ dateOfBirth: tenYearsAgo.toISOString().split("T")[0] })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("You must be at least 18 years old");
  });

  // --- Successful updates ---

  it("successfully updates username when missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // Current user has no username
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: null,
      email: "existing@example.com",
      dateOfBirth: new Date("2000-01-01"),
    } as never);
    // Username uniqueness check - not taken
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    await completeProfile(
      prevState,
      makeFormData({ username: "newuser" })
    );

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { username: "newuser" },
    });
    expect(mockRedirect).toHaveBeenCalledWith("/feed");
  });

  it("successfully updates email when missing and sends verification email", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // Current user has no email
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "existinguser",
      email: null,
      dateOfBirth: new Date("2000-01-01"),
    } as never);
    // Email uniqueness check - not taken
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({
      count: 0,
    } as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);

    await completeProfile(
      prevState,
      makeFormData({ email: "new@example.com" })
    );

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { email: "new@example.com", pendingEmail: "new@example.com" },
    });

    // Cleans up old tokens
    expect(mockPrisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "email-verify:new@example.com" },
    });

    // Creates verification token
    expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith({
      data: {
        identifier: "email-verify:new@example.com",
        token: expect.any(String),
        expires: expect.any(Date),
      },
    });

    // Sends verification email
    expect(mockSendEmail).toHaveBeenCalledWith({
      toEmail: "new@example.com",
      token: expect.any(String),
    });

    expect(mockRedirect).toHaveBeenCalledWith("/feed");
  });

  it("successfully updates dateOfBirth when missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "existinguser",
      email: "existing@example.com",
      dateOfBirth: null,
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    await completeProfile(
      prevState,
      makeFormData({ dateOfBirth: validDob() })
    );

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { dateOfBirth: expect.any(Date) },
    });
    expect(mockRedirect).toHaveBeenCalledWith("/feed");
  });

  it("successfully updates all three when all missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // Current user has nothing
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: null,
      email: null,
      dateOfBirth: null,
    } as never);
    // Username uniqueness check - not taken
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    // Email uniqueness check - not taken
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({
      count: 0,
    } as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);

    await completeProfile(
      prevState,
      makeFormData({
        username: "newuser",
        email: "new@example.com",
        dateOfBirth: validDob(),
      })
    );

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: {
        username: "newuser",
        email: "new@example.com",
        pendingEmail: "new@example.com",
        dateOfBirth: expect.any(Date),
      },
    });

    // Sends verification email for the new email
    expect(mockSendEmail).toHaveBeenCalledWith({
      toEmail: "new@example.com",
      token: expect.any(String),
    });

    expect(mockRedirect).toHaveBeenCalledWith("/feed");
  });

  it("skips validation for fields the user already has", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // Current user already has all fields
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "existinguser",
      email: "existing@example.com",
      dateOfBirth: new Date("2000-01-01"),
    } as never);

    // Should not call update since nothing is missing
    await completeProfile(prevState, makeFormData({}));

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    // Should not send verification email
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/feed");
  });

  it("redirects to /feed on success", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "existinguser",
      email: "existing@example.com",
      dateOfBirth: null,
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    await completeProfile(
      prevState,
      makeFormData({ dateOfBirth: validDob() })
    );

    expect(mockRedirect).toHaveBeenCalledWith("/feed");
  });
});
