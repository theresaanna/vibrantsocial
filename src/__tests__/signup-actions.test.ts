import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    verificationToken: { create: vi.fn() },
  },
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn() } }));
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {
    type = "CredentialsSignin";
  },
}));
vi.mock("@/lib/auto-friend", () => ({ autoFriendNewUser: vi.fn() }));
vi.mock("@/lib/inngest", () => ({ inngest: { send: vi.fn() } }));
vi.mock("@/lib/email", () => ({ sendEmailVerificationEmail: vi.fn() }));

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { autoFriendNewUser } from "@/lib/auto-friend";
import { inngest } from "@/lib/inngest";
import { sendEmailVerificationEmail } from "@/lib/email";
import { signup } from "@/app/signup/actions";

const mockPrisma = vi.mocked(prisma);
const mockBcrypt = vi.mocked(bcrypt);
const mockSignIn = vi.mocked(signIn);
const mockAutoFriend = vi.mocked(autoFriendNewUser);
const mockInngest = vi.mocked(inngest);
const mockSendEmailVerification = vi.mocked(sendEmailVerificationEmail);

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

function validFormData(overrides: Record<string, string> = {}): FormData {
  return makeFormData({
    email: "test@example.com",
    username: "testuser",
    dateOfBirth: validDob(),
    password: "password123",
    confirmPassword: "password123",
    agreeToTos: "true",
    ...overrides,
  });
}

const prevState = { success: false, message: "" };

describe("signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if required fields are missing", async () => {
    const result = await signup(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("All fields are required");
  });

  it("returns error if TOS not agreed", async () => {
    const result = await signup(
      prevState,
      validFormData({ agreeToTos: "false" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "You must agree to the Terms of Service and Privacy Policy"
    );
  });

  it("returns error if username format is invalid", async () => {
    const result = await signup(
      prevState,
      validFormData({ username: "a!" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "Username must be 3-30 characters, letters, numbers, and underscores only"
    );
  });

  it("returns error if user is under 18", async () => {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const result = await signup(
      prevState,
      validFormData({ dateOfBirth: tenYearsAgo.toISOString().split("T")[0] })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "You must be at least 18 years old to sign up"
    );
  });

  it("returns error if email format is invalid", async () => {
    const result = await signup(
      prevState,
      validFormData({ email: "not-an-email" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email address");
  });

  it("returns error if password is too short", async () => {
    const result = await signup(
      prevState,
      validFormData({ password: "short", confirmPassword: "short" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Password must be at least 8 characters");
  });

  it("returns error if passwords don't match", async () => {
    const result = await signup(
      prevState,
      validFormData({ password: "password123", confirmPassword: "different1" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Passwords do not match");
  });

  it("returns error if email already exists", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "existing",
      email: "test@example.com",
    } as never);

    const result = await signup(prevState, validFormData());
    expect(result.success).toBe(false);
    expect(result.message).toBe("An account with this email already exists");
  });

  it("returns error if username already taken", async () => {
    // First findUnique for email returns null
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    // Second findUnique for username returns existing user
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "existing",
      username: "testuser",
    } as never);

    const result = await signup(prevState, validFormData());
    expect(result.success).toBe(false);
    expect(result.message).toBe("This username is already taken");
  });

  it("creates user WITHOUT emailVerified field", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null as never);
    mockBcrypt.hash.mockResolvedValueOnce("hashed-password" as never);
    mockPrisma.user.create.mockResolvedValueOnce({
      id: "new-user",
    } as never);
    mockAutoFriend.mockResolvedValueOnce(undefined as never);
    mockInngest.send.mockResolvedValueOnce(undefined as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);
    mockSignIn.mockResolvedValueOnce(undefined as never);

    await signup(prevState, validFormData());

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data).not.toHaveProperty("emailVerified");
  });

  it("creates user WITH pendingEmail set to the email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null as never);
    mockBcrypt.hash.mockResolvedValueOnce("hashed-password" as never);
    mockPrisma.user.create.mockResolvedValueOnce({
      id: "new-user",
    } as never);
    mockAutoFriend.mockResolvedValueOnce(undefined as never);
    mockInngest.send.mockResolvedValueOnce(undefined as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);
    mockSignIn.mockResolvedValueOnce(undefined as never);

    await signup(prevState, validFormData({ email: "MyEmail@Example.COM" }));

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.pendingEmail).toBe("myemail@example.com");
  });

  it("creates a verificationToken after user creation", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null as never);
    mockBcrypt.hash.mockResolvedValueOnce("hashed-password" as never);
    mockPrisma.user.create.mockResolvedValueOnce({
      id: "new-user",
    } as never);
    mockAutoFriend.mockResolvedValueOnce(undefined as never);
    mockInngest.send.mockResolvedValueOnce(undefined as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);
    mockSignIn.mockResolvedValueOnce(undefined as never);

    await signup(prevState, validFormData());

    expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith({
      data: {
        identifier: "email-verify:test@example.com",
        token: expect.any(String),
        expires: expect.any(Date),
      },
    });
  });

  it("calls sendEmailVerificationEmail after user creation", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null as never);
    mockBcrypt.hash.mockResolvedValueOnce("hashed-password" as never);
    mockPrisma.user.create.mockResolvedValueOnce({
      id: "new-user",
    } as never);
    mockAutoFriend.mockResolvedValueOnce(undefined as never);
    mockInngest.send.mockResolvedValueOnce(undefined as never);
    mockPrisma.verificationToken.create.mockResolvedValueOnce({} as never);
    mockSignIn.mockResolvedValueOnce(undefined as never);

    await signup(prevState, validFormData());

    expect(mockSendEmailVerification).toHaveBeenCalledWith({
      toEmail: "test@example.com",
      token: expect.any(String),
    });
  });
});
