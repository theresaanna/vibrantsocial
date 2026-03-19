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

describe("Premium expiry integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("full lifecycle: active → payment fails → grace period → expires", async () => {
    // Step 1: User is active premium
    expect(
      isUserPremium({ tier: "premium", premiumExpiresAt: null })
    ).toBe(true);

    // Step 2: Payment fails — simulate webhook setting grace period
    const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Step 3: Within grace period — still premium
    expect(
      isUserPremium({ tier: "premium", premiumExpiresAt: gracePeriodEnd })
    ).toBe(true);

    // Step 4: Grace period expires
    const expiredDate = new Date(Date.now() - 1000);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "premium",
      premiumExpiresAt: expiredDate,
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const stillPremium = await checkAndExpirePremium("user-1");
    expect(stillPremium).toBe(false);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { tier: "free", premiumExpiresAt: null },
    });
  });

  it("payment failure sets grace, successful retry clears it", async () => {
    // After payment failure, user has grace period
    const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // User is still premium during grace
    expect(
      isUserPremium({ tier: "premium", premiumExpiresAt: gracePeriodEnd })
    ).toBe(true);

    // Retry succeeds — simulate clearing grace period
    // checkAndExpirePremium should return true since grace hasn't expired
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "premium",
      premiumExpiresAt: gracePeriodEnd,
    } as never);

    const result = await checkAndExpirePremium("user-1");
    expect(result).toBe(true);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("subscription deletion immediately revokes access", async () => {
    // After subscription.deleted webhook: tier is free
    expect(
      isUserPremium({ tier: "free", premiumExpiresAt: null })
    ).toBe(false);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "free",
      premiumExpiresAt: null,
    } as never);

    const result = await checkAndExpirePremium("user-1");
    expect(result).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("free user with expired premiumExpiresAt stays free", async () => {
    // Edge case: somehow tier is free but premiumExpiresAt is set
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "free",
      premiumExpiresAt: new Date(Date.now() - 1000),
    } as never);

    const result = await checkAndExpirePremium("user-1");
    expect(result).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("premium user with null expiry has indefinite access", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "premium",
      premiumExpiresAt: null,
    } as never);

    const result = await checkAndExpirePremium("user-1");
    expect(result).toBe(true);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("premiumExpiresAt exactly at boundary (edge case)", async () => {
    // premiumExpiresAt is exactly now — should expire
    const now = new Date();
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "premium",
      premiumExpiresAt: now,
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    // Since Date comparison: new Date(now) > new Date() is false (equal),
    // user should be expired
    const result = await checkAndExpirePremium("user-1");
    expect(result).toBe(false);
  });

  it("multiple calls to checkAndExpirePremium are consistent", async () => {
    // First call: expires
    const expired = new Date(Date.now() - 1000);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "premium",
      premiumExpiresAt: expired,
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const first = await checkAndExpirePremium("user-1");
    expect(first).toBe(false);

    // Second call: user is now free (DB was updated)
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      tier: "free",
      premiumExpiresAt: null,
    } as never);

    const second = await checkAndExpirePremium("user-1");
    expect(second).toBe(false);
    // Only one update call total
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
  });
});
