import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies before imports
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({
        id: "notif1",
        type: "REFERRAL_SIGNUP",
        actorId: "referred1",
        targetUserId: "referrer1",
        actor: { id: "referred1", username: "newuser", displayName: null, name: null, image: null, avatar: null, profileFrameId: null, usernameFont: null },
      }),
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
    },
    block: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/ably", () => ({
  getAblyRestClient: () => ({
    channels: {
      get: () => ({ publish: vi.fn() }),
    },
  }),
}));

vi.mock("@/lib/web-push", () => ({
  sendPushNotification: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  awardReferralSignupStars,
  awardReferralFirstPostBonus,
  checkStarsMilestone,
} from "@/lib/referral";
import { POST } from "@/app/api/redeem-stars/route";

const mockPrisma = vi.mocked(prisma);
const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Referral signup bonus", () => {
  it("awards 50 stars to the referrer when a referred user signs up", async () => {
    await awardReferralSignupStars("referrer1", "referred1");

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "referrer1" },
      data: { stars: { increment: 50 } },
    });
  });

  it("creates a REFERRAL_SIGNUP notification for the referrer", async () => {
    await awardReferralSignupStars("referrer1", "referred1");

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "REFERRAL_SIGNUP",
          actorId: "referred1",
          targetUserId: "referrer1",
        }),
      })
    );
  });
});

describe("Referral first post bonus", () => {
  it("awards 50 stars to the referrer when referred user makes first post", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      referredById: "referrer1",
      referralBonusPaid: false,
    } as never);

    await awardReferralFirstPostBonus("referred1");

    // Should mark bonus as paid
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "referred1" },
      data: { referralBonusPaid: true },
    });

    // Should award 50 stars to referrer
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "referrer1" },
      data: { stars: { increment: 50 } },
    });
  });

  it("does NOT award bonus on second post", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      referredById: "referrer1",
      referralBonusPaid: true,
    } as never);

    await awardReferralFirstPostBonus("referred1");

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("does nothing if user was not referred", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      referredById: null,
      referralBonusPaid: false,
    } as never);

    await awardReferralFirstPostBonus("user1");

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe("Stars milestone notification", () => {
  it("creates STARS_MILESTONE notification when user reaches 500 stars", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      stars: 500,
    } as never);
    mockPrisma.notification.findFirst.mockResolvedValueOnce(null);

    await checkStarsMilestone("user1");

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "STARS_MILESTONE",
          actorId: "user1",
          targetUserId: "user1",
        }),
      })
    );
  });

  it("does NOT create duplicate milestone notification", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      stars: 600,
    } as never);
    mockPrisma.notification.findFirst.mockResolvedValueOnce({
      id: "existing-milestone",
    } as never);

    await checkStarsMilestone("user1");

    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it("does nothing if user has fewer than 500 stars", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      stars: 499,
    } as never);

    await checkStarsMilestone("user1");

    expect(mockPrisma.notification.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });
});

describe("Redeem stars for premium", () => {
  it("deducts 500 stars and activates premium", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      stars: 500,
      tier: "free",
      premiumExpiresAt: null,
    } as never);

    const response = await POST();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user1" },
        data: expect.objectContaining({
          stars: { decrement: 500 },
          starsSpent: { increment: 500 },
          tier: "premium",
        }),
      })
    );
  });

  it("extends premium if already premium", async () => {
    const existingExpiry = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days left
    mockAuth.mockResolvedValue({
      user: { id: "user1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      stars: 500,
      tier: "premium",
      premiumExpiresAt: existingExpiry,
    } as never);

    const response = await POST();
    const data = await response.json();

    expect(data.success).toBe(true);
    // Expiry should be ~45 days from now (15 existing + 30 new)
    const newExpiry = new Date(data.premiumExpiresAt);
    const expectedMin = new Date(existingExpiry.getTime() + 29 * 24 * 60 * 60 * 1000);
    expect(newExpiry.getTime()).toBeGreaterThan(expectedMin.getTime());
  });

  it("rejects if user has fewer than 500 stars", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      stars: 499,
      tier: "free",
      premiumExpiresAt: null,
    } as never);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Not enough stars");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects if not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const response = await POST();
    expect(response.status).toBe(401);
  });
});
