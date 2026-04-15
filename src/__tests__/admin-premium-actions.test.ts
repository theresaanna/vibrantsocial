import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    premiumComp: { create: vi.fn() },
  },
}));

vi.mock("@/lib/premium-comps", async () => {
  const actual = await vi.importActual<typeof import("@/lib/premium-comps")>(
    "@/lib/premium-comps"
  );
  return {
    ...actual,
    extendPremiumTrial: vi.fn(),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { extendPremiumTrial, PremiumCompError } from "@/lib/premium-comps";
import { extendPremium } from "@/app/admin/premium-actions";

const mockAuth = vi.mocked(auth);
const mockIsAdmin = vi.mocked(isAdmin);
const mockPrisma = vi.mocked(prisma);
const mockExtendPremiumTrial = vi.mocked(extendPremiumTrial);

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, val] of Object.entries(entries)) {
    fd.set(key, val);
  }
  return fd;
}

describe("extendPremium server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "admin-1" } } as never);
    mockIsAdmin.mockReturnValue(true);
  });

  it("comps months on a Stripe-backed premium user and records audit row", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "spoilingpixie",
      tier: "premium",
      stripeSubscriptionId: "sub_test",
    } as never);
    mockExtendPremiumTrial.mockResolvedValue({
      stripeSubscriptionId: "sub_test",
      previousTrialEnd: null,
      newTrialEnd: new Date("2026-08-01T00:00:00Z"),
      months: 3,
      status: "active",
    });
    mockPrisma.premiumComp.create.mockResolvedValue({} as never);

    const result = await extendPremium(
      null,
      makeFormData({ userId: "user-1", months: "3", reason: "contest winner" })
    );

    expect(result).toEqual({
      ok: true,
      message: expect.stringContaining("spoilingpixie"),
    });
    expect(mockExtendPremiumTrial).toHaveBeenCalledWith({
      stripeSubscriptionId: "sub_test",
      months: 3,
    });
    expect(mockPrisma.premiumComp.create).toHaveBeenCalledWith({
      data: {
        adminId: "admin-1",
        userId: "user-1",
        months: 3,
        stripeSubscriptionId: "sub_test",
        previousTrialEnd: null,
        newTrialEnd: new Date("2026-08-01T00:00:00Z"),
        reason: "contest winner",
      },
    });
  });

  it("stores empty reason as undefined (not empty string)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "u",
      tier: "premium",
      stripeSubscriptionId: "sub_test",
    } as never);
    mockExtendPremiumTrial.mockResolvedValue({
      stripeSubscriptionId: "sub_test",
      previousTrialEnd: null,
      newTrialEnd: new Date("2026-08-01T00:00:00Z"),
      months: 1,
      status: "active",
    });

    await extendPremium(
      null,
      makeFormData({ userId: "user-1", months: "1", reason: "" })
    );

    expect(mockPrisma.premiumComp.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: undefined }),
      })
    );
  });

  it("rejects non-admin callers", async () => {
    mockIsAdmin.mockReturnValue(false);

    await expect(
      extendPremium(null, makeFormData({ userId: "user-1", months: "1" }))
    ).rejects.toThrow("Unauthorized");

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns an error when user is not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await extendPremium(
      null,
      makeFormData({ userId: "user-missing", months: "1" })
    );

    expect(result).toEqual({ ok: false, error: "User not found" });
    expect(mockExtendPremiumTrial).not.toHaveBeenCalled();
  });

  it("returns an error when user is not on premium tier", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "u",
      tier: "free",
      stripeSubscriptionId: null,
    } as never);

    const result = await extendPremium(
      null,
      makeFormData({ userId: "user-1", months: "1" })
    );

    expect(result).toEqual({
      ok: false,
      error: "User is not on the premium tier",
    });
  });

  it("returns an error when premium user has no Stripe subscription", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "u",
      tier: "premium",
      stripeSubscriptionId: null,
    } as never);

    const result = await extendPremium(
      null,
      makeFormData({ userId: "user-1", months: "1" })
    );

    expect(result).not.toBeNull();
    expect(result!.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error).toMatch(/no Stripe subscription/i);
    }
    expect(mockExtendPremiumTrial).not.toHaveBeenCalled();
  });

  it("surfaces PremiumCompError messages as user-facing errors", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "u",
      tier: "premium",
      stripeSubscriptionId: "sub_test",
    } as never);
    mockExtendPremiumTrial.mockRejectedValue(
      new PremiumCompError(
        "bad_status",
        'Subscription status is "past_due"; only active or trialing subscriptions can be extended'
      )
    );

    const result = await extendPremium(
      null,
      makeFormData({ userId: "user-1", months: "1" })
    );

    expect(result).not.toBeNull();
    expect(result!.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error).toMatch(/past_due/);
    }
    expect(mockPrisma.premiumComp.create).not.toHaveBeenCalled();
  });

  it("surfaces unexpected Stripe errors", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "u",
      tier: "premium",
      stripeSubscriptionId: "sub_test",
    } as never);
    mockExtendPremiumTrial.mockRejectedValue(new Error("network blew up"));

    const result = await extendPremium(
      null,
      makeFormData({ userId: "user-1", months: "1" })
    );

    expect(result).not.toBeNull();
    expect(result!.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error).toMatch(/Stripe error: network blew up/);
    }
  });

  it("validates input: rejects missing months", async () => {
    const result = await extendPremium(
      null,
      makeFormData({ userId: "user-1" })
    );
    expect(result).not.toBeNull();
    expect(result!.ok).toBe(false);
  });

  it("validates input: rejects months > 24", async () => {
    const result = await extendPremium(
      null,
      makeFormData({ userId: "user-1", months: "25" })
    );
    expect(result).not.toBeNull();
    expect(result!.ok).toBe(false);
  });

  it("validates input: rejects missing userId", async () => {
    const result = await extendPremium(
      null,
      makeFormData({ userId: "", months: "1" })
    );
    expect(result).not.toBeNull();
    expect(result!.ok).toBe(false);
  });
});
