import { describe, it, expect, vi, beforeEach } from "vitest";
import { signup } from "@/app/signup/actions";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    follow: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  signIn: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
  },
}));

import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";

const mockPrisma = vi.mocked(prisma);
const mockSignIn = vi.mocked(signIn);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };

describe("signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires all fields", async () => {
    const result = await signup(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("All fields are required");
  });

  it("requires email to be present", async () => {
    const result = await signup(
      prevState,
      makeFormData({ password: "password123", confirmPassword: "password123" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("All fields are required");
  });

  it("validates email format", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        email: "notanemail",
        password: "password123",
        confirmPassword: "password123",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email address");
  });

  it("rejects emails without @ symbol", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        email: "userexample.com",
        password: "password123",
        confirmPassword: "password123",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email address");
  });

  it("requires password to be at least 8 characters", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        email: "user@example.com",
        password: "short",
        confirmPassword: "short",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Password must be at least 8 characters");
  });

  it("requires passwords to match", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        email: "user@example.com",
        password: "password123",
        confirmPassword: "password456",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Passwords do not match");
  });

  it("rejects duplicate email addresses", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "existing-user",
    } as never);

    const result = await signup(
      prevState,
      makeFormData({
        email: "existing@example.com",
        password: "password123",
        confirmPassword: "password123",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("An account with this email already exists");
  });

  it("creates user and auto-follows first user on success", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.create.mockResolvedValueOnce({
      id: "new-user-id",
    } as never);
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: "first-user-id",
    } as never);
    // signIn throws NEXT_REDIRECT on success
    mockSignIn.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(
      signup(
        prevState,
        makeFormData({
          email: "new@example.com",
          password: "password123",
          confirmPassword: "password123",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "new@example.com",
        passwordHash: "hashed_password",
        emailVerified: expect.any(Date),
      }),
    });

    expect(mockPrisma.follow.create).toHaveBeenCalledWith({
      data: {
        followerId: "new-user-id",
        followingId: "first-user-id",
      },
    });
  });

  it("normalizes email to lowercase", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.create.mockResolvedValueOnce({ id: "new-id" } as never);
    mockPrisma.user.findFirst.mockResolvedValueOnce(null as never);
    mockSignIn.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(
      signup(
        prevState,
        makeFormData({
          email: "USER@EXAMPLE.COM",
          password: "password123",
          confirmPassword: "password123",
        })
      )
    ).rejects.toThrow();

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "user@example.com" }),
    });
  });

  it("does not auto-follow if user is the first user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.create.mockResolvedValueOnce({ id: "first-user-id" } as never);
    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: "first-user-id" } as never);
    mockSignIn.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(
      signup(
        prevState,
        makeFormData({
          email: "first@example.com",
          password: "password123",
          confirmPassword: "password123",
        })
      )
    ).rejects.toThrow();

    expect(mockPrisma.follow.create).not.toHaveBeenCalled();
  });
});
