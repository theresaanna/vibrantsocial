import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  isProfileIncomplete,
  checkProfileCompletion,
} from "@/lib/require-profile";

const mockPrisma = vi.mocked(prisma);

describe("isProfileIncomplete", () => {
  it("returns true when user is null", () => {
    expect(isProfileIncomplete(null)).toBe(true);
  });

  it("returns true when username is null", () => {
    expect(
      isProfileIncomplete({
        username: null,
        email: "user@example.com",
        dateOfBirth: new Date("2000-01-01"),
      })
    ).toBe(true);
  });

  it("returns true when email is null", () => {
    expect(
      isProfileIncomplete({
        username: "testuser",
        email: null,
        dateOfBirth: new Date("2000-01-01"),
      })
    ).toBe(true);
  });

  it("returns true when dateOfBirth is null", () => {
    expect(
      isProfileIncomplete({
        username: "testuser",
        email: "user@example.com",
        dateOfBirth: null,
      })
    ).toBe(true);
  });

  it("returns false when all fields are present", () => {
    expect(
      isProfileIncomplete({
        username: "testuser",
        email: "user@example.com",
        dateOfBirth: new Date("2000-01-01"),
      })
    ).toBe(false);
  });
});

describe("checkProfileCompletion", () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns "/complete-profile" when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await checkProfileCompletion("user1");
    expect(result).toBe("/complete-profile");
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user1" },
      select: { username: true, email: true, dateOfBirth: true },
    });
  });

  it('returns "/complete-profile" when username is missing', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: null,
      email: "user@example.com",
      dateOfBirth: new Date("2000-01-01"),
    } as never);

    const result = await checkProfileCompletion("user1");
    expect(result).toBe("/complete-profile");
  });

  it('returns "/complete-profile" when email is missing', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "testuser",
      email: null,
      dateOfBirth: new Date("2000-01-01"),
    } as never);

    const result = await checkProfileCompletion("user1");
    expect(result).toBe("/complete-profile");
  });

  it('returns "/complete-profile" when dateOfBirth is missing', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "testuser",
      email: "user@example.com",
      dateOfBirth: null,
    } as never);

    const result = await checkProfileCompletion("user1");
    expect(result).toBe("/complete-profile");
  });

  it("returns null when all fields are present", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "testuser",
      email: "user@example.com",
      dateOfBirth: new Date("2000-01-01"),
    } as never);

    const result = await checkProfileCompletion("user1");
    expect(result).toBeNull();
  });
});
