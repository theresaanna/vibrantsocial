import { describe, it, expect, vi, beforeEach } from "vitest";
import { signup } from "@/app/signup/actions";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    follow: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
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

vi.mock("@/lib/email", () => ({
  sendWelcomeEmail: vi.fn(),
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

// A valid date of birth for a 20-year-old
function validDob(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 20);
  return d.toISOString().split("T")[0];
}

const prevState = { success: false, message: "" };

const validFields = {
  email: "user@example.com",
  username: "testuser",
  dateOfBirth: validDob(),
  password: "password123",
  confirmPassword: "password123",
  agreeToTos: "true",
};

describe("signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires all fields", async () => {
    const result = await signup(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("All fields are required");
  });

  it("rejects signup without TOS agreement", async () => {
    const { agreeToTos: _, ...fieldsWithoutTos } = validFields;
    const result = await signup(prevState, makeFormData(fieldsWithoutTos));
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "You must agree to the Terms of Service and Privacy Policy"
    );
  });

  it("requires email to be present", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        username: "testuser",
        dateOfBirth: validDob(),
        password: "password123",
        confirmPassword: "password123",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("All fields are required");
  });

  it("requires username to be present", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        email: "user@example.com",
        dateOfBirth: validDob(),
        password: "password123",
        confirmPassword: "password123",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("All fields are required");
  });

  it("requires dateOfBirth to be present", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        email: "user@example.com",
        username: "testuser",
        password: "password123",
        confirmPassword: "password123",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("All fields are required");
  });

  it("validates username format - too short", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        ...validFields,
        username: "ab",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "Username must be 3-30 characters, letters, numbers, and underscores only"
    );
  });

  it("validates username format - special characters", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        ...validFields,
        username: "user@name",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "Username must be 3-30 characters, letters, numbers, and underscores only"
    );
  });

  it("validates username format - spaces", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        ...validFields,
        username: "user name",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "Username must be 3-30 characters, letters, numbers, and underscores only"
    );
  });

  it("validates email format", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        ...validFields,
        email: "notanemail",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email address");
  });

  it("rejects emails without @ symbol", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        ...validFields,
        email: "userexample.com",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email address");
  });

  it("rejects invalid date of birth", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        ...validFields,
        dateOfBirth: "not-a-date",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid date of birth");
  });

  it("rejects future date of birth", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await signup(
      prevState,
      makeFormData({
        ...validFields,
        dateOfBirth: tomorrow.toISOString().split("T")[0],
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Date of birth cannot be in the future");
  });

  it("rejects users under 18 years old", async () => {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

    const result = await signup(
      prevState,
      makeFormData({
        ...validFields,
        dateOfBirth: tenYearsAgo.toISOString().split("T")[0],
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "You must be at least 18 years old to sign up"
    );
  });

  it("rejects users who are 17 years old", async () => {
    const seventeenYearsAgo = new Date();
    seventeenYearsAgo.setFullYear(seventeenYearsAgo.getFullYear() - 17);

    const result = await signup(
      prevState,
      makeFormData({
        ...validFields,
        dateOfBirth: seventeenYearsAgo.toISOString().split("T")[0],
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "You must be at least 18 years old to sign up"
    );
  });

  it("requires password to be at least 8 characters", async () => {
    const result = await signup(
      prevState,
      makeFormData({
        ...validFields,
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
        ...validFields,
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
        ...validFields,
        email: "existing@example.com",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("An account with this email already exists");
  });

  it("rejects duplicate usernames", async () => {
    // First findUnique: email check (null = no existing user)
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    // Second findUnique: username check (taken)
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "existing-user",
    } as never);

    const result = await signup(
      prevState,
      makeFormData({
        ...validFields,
        username: "takenuser",
      })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("This username is already taken");
  });

  it("creates user with username, dateOfBirth and auto-friends with theresa on success", async () => {
    // First findUnique: email check (null = no existing user)
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    // Second findUnique: username check (null = available)
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.create.mockResolvedValueOnce({
      id: "new-user-id",
    } as never);
    // Third findUnique: theresa lookup by username
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "theresa-id",
    } as never);
    mockPrisma.$transaction.mockResolvedValueOnce(undefined as never);
    // signIn throws NEXT_REDIRECT on success
    mockSignIn.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(
      signup(
        prevState,
        makeFormData({
          ...validFields,
          email: "new@example.com",
          username: "newuser",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "new@example.com",
        username: "newuser",
        passwordHash: "hashed_password",
        dateOfBirth: expect.any(Date),
        emailVerified: expect.any(Date),
      }),
    });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("normalizes email to lowercase", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.create.mockResolvedValueOnce({ id: "new-id" } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockSignIn.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(
      signup(
        prevState,
        makeFormData({
          ...validFields,
          email: "USER@EXAMPLE.COM",
        })
      )
    ).rejects.toThrow();

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "user@example.com" }),
    });
  });

  it("normalizes username to lowercase", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.create.mockResolvedValueOnce({ id: "new-id" } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockSignIn.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(
      signup(
        prevState,
        makeFormData({
          ...validFields,
          username: "MyUser",
        })
      )
    ).rejects.toThrow();

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ username: "myuser" }),
    });
  });

  it("does not auto-friend if theresa user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.create.mockResolvedValueOnce({
      id: "new-user-id",
    } as never);
    // theresa lookup returns null
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockSignIn.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(
      signup(
        prevState,
        makeFormData({
          ...validFields,
          email: "first@example.com",
        })
      )
    ).rejects.toThrow();

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("accepts valid usernames with underscores and numbers", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.user.create.mockResolvedValueOnce({ id: "new-id" } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    mockSignIn.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(
      signup(
        prevState,
        makeFormData({
          ...validFields,
          username: "user_123",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ username: "user_123" }),
    });
  });
});
