import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { calculateAge, requireMinimumAge } from "@/lib/age-gate";

const mockPrisma = vi.mocked(prisma);

describe("calculateAge", () => {
  it("returns correct age for a date well in the past", () => {
    const dob = new Date("1990-01-01");
    const age = calculateAge(dob);
    const expectedYear = new Date().getFullYear() - 1990;
    // Age could be expectedYear or expectedYear - 1 depending on current date
    expect(age).toBeGreaterThanOrEqual(expectedYear - 1);
    expect(age).toBeLessThanOrEqual(expectedYear);
  });

  it("returns 0 for a date of birth today", () => {
    const today = new Date();
    expect(calculateAge(today)).toBe(0);
  });

  it("accounts for birthday not yet passed this year", () => {
    const today = new Date();
    // Create a DOB that is 20 years ago but 1 month in the future
    const futureMonth = today.getMonth() + 1;
    const dob = new Date(today.getFullYear() - 20, futureMonth, 15);
    if (futureMonth <= 11) {
      // Birthday hasn't happened yet this year
      expect(calculateAge(dob)).toBe(19);
    }
  });

  it("accounts for birthday already passed this year", () => {
    const today = new Date();
    // Create a DOB that is 20 years ago and 1 month in the past
    const pastMonth = today.getMonth() - 1;
    const dob = new Date(today.getFullYear() - 20, pastMonth, 15);
    if (pastMonth >= 0) {
      // Birthday already happened
      expect(calculateAge(dob)).toBe(20);
    }
  });
});

describe("requireMinimumAge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when user is not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await requireMinimumAge("nonexistent", 18);
    expect(result).toBe(false);
  });

  it("returns false when user has no dateOfBirth", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      dateOfBirth: null,
    } as never);

    const result = await requireMinimumAge("user1", 18);
    expect(result).toBe(false);
  });

  it("returns false when user is under the minimum age", async () => {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      dateOfBirth: tenYearsAgo,
    } as never);

    const result = await requireMinimumAge("user1", 18);
    expect(result).toBe(false);
  });

  it("returns true when user is exactly the minimum age", async () => {
    const exactlyEighteen = new Date();
    exactlyEighteen.setFullYear(exactlyEighteen.getFullYear() - 18);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      dateOfBirth: exactlyEighteen,
    } as never);

    const result = await requireMinimumAge("user1", 18);
    expect(result).toBe(true);
  });

  it("returns true when user is over the minimum age", async () => {
    const thirtyYearsAgo = new Date();
    thirtyYearsAgo.setFullYear(thirtyYearsAgo.getFullYear() - 30);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      dateOfBirth: thirtyYearsAgo,
    } as never);

    const result = await requireMinimumAge("user1", 18);
    expect(result).toBe(true);
  });

  it("queries with the correct userId", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    await requireMinimumAge("test-user-id", 18);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "test-user-id" },
      select: { dateOfBirth: true },
    });
  });
});
