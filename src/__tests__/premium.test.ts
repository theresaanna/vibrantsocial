import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { isUserPremium, checkAndExpirePremium } from "@/lib/premium";

const mockPrisma = vi.mocked(prisma);

describe("isUserPremium", () => {
  it("returns true when tier is premium and premiumExpiresAt is null", () => {
    expect(isUserPremium({ tier: "premium", premiumExpiresAt: null })).toBe(true);
  });

  it("returns true when tier is premium and premiumExpiresAt is in the future", () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    expect(isUserPremium({ tier: "premium", premiumExpiresAt: future })).toBe(true);
  });

  it("returns false when tier is premium and premiumExpiresAt is in the past", () => {
    const past = new Date(Date.now() - 1000);
    expect(isUserPremium({ tier: "premium", premiumExpiresAt: past })).toBe(false);
  });

  it("returns false when tier is free regardless of premiumExpiresAt", () => {
    expect(isUserPremium({ tier: "free", premiumExpiresAt: null })).toBe(false);
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    expect(isUserPremium({ tier: "free", premiumExpiresAt: future })).toBe(false);
  });

  it("returns false for unknown tier values", () => {
    expect(isUserPremium({ tier: "basic", premiumExpiresAt: null })).toBe(false);
  });
});

describe("checkAndExpirePremium", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false when user is not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    expect(await checkAndExpirePremium("missing-user")).toBe(false);
  });

  it("returns false for free tier user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "free",
      premiumExpiresAt: null,
    } as never);
    expect(await checkAndExpirePremium("user-1")).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns true for active premium user with no expiry", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "premium",
      premiumExpiresAt: null,
    } as never);
    expect(await checkAndExpirePremium("user-1")).toBe(true);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns true for premium user within grace period", async () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "premium",
      premiumExpiresAt: future,
    } as never);
    expect(await checkAndExpirePremium("user-1")).toBe(true);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns false and updates DB for expired premium user", async () => {
    const past = new Date(Date.now() - 1000);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "premium",
      premiumExpiresAt: past,
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    expect(await checkAndExpirePremium("user-1")).toBe(false);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { tier: "free", premiumExpiresAt: null },
    });
  });

  it("does not call update for non-expired premium user", async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "premium",
      premiumExpiresAt: future,
    } as never);
    await checkAndExpirePremium("user-1");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("does not call update for free tier user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "free",
      premiumExpiresAt: null,
    } as never);
    await checkAndExpirePremium("user-1");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
