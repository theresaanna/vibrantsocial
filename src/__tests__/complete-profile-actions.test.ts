import { describe, it, expect, vi, beforeEach } from "vitest";
import { completeProfile } from "@/app/complete-profile/actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
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

  it("returns error if dateOfBirth is missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await completeProfile(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Date of birth is required");
  });

  it("returns error for invalid date", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await completeProfile(
      prevState,
      makeFormData({ dateOfBirth: "not-a-date" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid date of birth");
  });

  it("returns error for future date", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await completeProfile(
      prevState,
      makeFormData({ dateOfBirth: tomorrow.toISOString().split("T")[0] })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Date of birth cannot be in the future");
  });

  it("returns error if user is under 13", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

    const result = await completeProfile(
      prevState,
      makeFormData({ dateOfBirth: tenYearsAgo.toISOString().split("T")[0] })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("You must be at least 13 years old");
  });

  it("updates user and redirects on valid date", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    await completeProfile(prevState, makeFormData({ dateOfBirth: validDob() }));

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { dateOfBirth: expect.any(Date) },
    });
    expect(mockRedirect).toHaveBeenCalledWith("/feed");
  });
});
