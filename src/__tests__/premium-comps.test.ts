import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/stripe", () => ({
  getSubscription: vi.fn(),
  extendSubscriptionTrial: vi.fn(),
}));

import { getSubscription, extendSubscriptionTrial } from "@/lib/stripe";
import {
  addMonths,
  computeNewTrialEnd,
  extendPremiumTrial,
  getCurrentPeriodEnd,
  PremiumCompError,
} from "@/lib/premium-comps";

const mockGetSubscription = vi.mocked(getSubscription);
const mockExtendSubscriptionTrial = vi.mocked(extendSubscriptionTrial);

/** Build a minimal Stripe subscription object for testing. */
function makeSub(overrides: {
  status?: string;
  periodEnd?: Date;
  trialEnd?: Date | null;
}) {
  const { status = "active", periodEnd, trialEnd } = overrides;
  return {
    id: "sub_test",
    status,
    trial_end:
      trialEnd === undefined
        ? null
        : trialEnd === null
          ? null
          : Math.floor(trialEnd.getTime() / 1000),
    items: {
      data: [
        {
          id: "si_test",
          current_period_end: periodEnd
            ? Math.floor(periodEnd.getTime() / 1000)
            : undefined,
        },
      ],
    },
  };
}

describe("addMonths", () => {
  it("adds whole months", () => {
    const result = addMonths(new Date("2026-01-15T00:00:00Z"), 3);
    expect(result.toISOString().slice(0, 10)).toBe("2026-04-15");
  });

  it("handles year rollover", () => {
    const result = addMonths(new Date("2026-11-15T00:00:00Z"), 3);
    expect(result.toISOString().slice(0, 10)).toBe("2027-02-15");
  });

  it("clamps day-of-month when target month is shorter", () => {
    // Jan 31 + 1 month → Feb 28 (2026 is not a leap year)
    const result = addMonths(new Date("2026-01-31T00:00:00Z"), 1);
    expect(result.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("clamps to Feb 29 in a leap year", () => {
    const result = addMonths(new Date("2024-01-31T00:00:00Z"), 1);
    expect(result.toISOString().slice(0, 10)).toBe("2024-02-29");
  });

  it("preserves time-of-day", () => {
    const result = addMonths(new Date("2026-01-15T12:34:56Z"), 2);
    expect(result.toISOString()).toBe("2026-03-15T12:34:56.000Z");
  });

  it("rejects non-integer months", () => {
    expect(() => addMonths(new Date(), 1.5)).toThrow();
  });

  it("handles 24 month extension", () => {
    const result = addMonths(new Date("2026-01-15T00:00:00Z"), 24);
    expect(result.toISOString().slice(0, 10)).toBe("2028-01-15");
  });
});

describe("getCurrentPeriodEnd", () => {
  it("prefers items[].current_period_end when present", () => {
    const sub = makeSub({ periodEnd: new Date("2026-05-01T00:00:00Z") });
    const end = getCurrentPeriodEnd(sub);
    expect(end?.toISOString().slice(0, 10)).toBe("2026-05-01");
  });

  it("falls back to top-level current_period_end", () => {
    const sub = {
      current_period_end: Math.floor(
        new Date("2026-06-01T00:00:00Z").getTime() / 1000
      ),
      items: { data: [] },
    };
    const end = getCurrentPeriodEnd(sub);
    expect(end?.toISOString().slice(0, 10)).toBe("2026-06-01");
  });

  it("returns null when no period end is available", () => {
    expect(getCurrentPeriodEnd({ items: { data: [] } })).toBe(null);
    expect(getCurrentPeriodEnd(null)).toBe(null);
  });

  it("uses earliest item when multiple items present", () => {
    const sub = {
      items: {
        data: [
          {
            current_period_end: Math.floor(
              new Date("2026-06-01T00:00:00Z").getTime() / 1000
            ),
          },
          {
            current_period_end: Math.floor(
              new Date("2026-05-01T00:00:00Z").getTime() / 1000
            ),
          },
        ],
      },
    };
    const end = getCurrentPeriodEnd(sub);
    expect(end?.toISOString().slice(0, 10)).toBe("2026-05-01");
  });
});

describe("computeNewTrialEnd", () => {
  it("anchors on current_period_end when no trial_end", () => {
    const sub = makeSub({
      periodEnd: new Date("2026-05-01T00:00:00Z"),
      trialEnd: null,
    });
    const { anchor, newTrialEnd } = computeNewTrialEnd(sub, 3);
    expect(anchor.toISOString().slice(0, 10)).toBe("2026-05-01");
    expect(newTrialEnd.toISOString().slice(0, 10)).toBe("2026-08-01");
  });

  it("anchors on trial_end when it's later than period end (stacking comps)", () => {
    // Simulates a second comp on an already-extended subscription:
    // trial_end was already pushed to 2026-08-01; period_end is 2026-05-01.
    const sub = makeSub({
      periodEnd: new Date("2026-05-01T00:00:00Z"),
      trialEnd: new Date("2026-08-01T00:00:00Z"),
    });
    const { anchor, newTrialEnd } = computeNewTrialEnd(sub, 3);
    expect(anchor.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(newTrialEnd.toISOString().slice(0, 10)).toBe("2026-11-01");
  });

  it("anchors on period_end when it's later than trial_end", () => {
    const sub = makeSub({
      periodEnd: new Date("2026-06-01T00:00:00Z"),
      trialEnd: new Date("2026-04-01T00:00:00Z"),
    });
    const { anchor, newTrialEnd } = computeNewTrialEnd(sub, 1);
    expect(anchor.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(newTrialEnd.toISOString().slice(0, 10)).toBe("2026-07-01");
  });

  it("throws when no anchor is available", () => {
    expect(() => computeNewTrialEnd({ items: { data: [] } }, 1)).toThrow(
      PremiumCompError
    );
  });
});

describe("extendPremiumTrial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extends an active subscription and returns the new trial end", async () => {
    mockGetSubscription.mockResolvedValue(
      makeSub({
        status: "active",
        periodEnd: new Date("2026-05-01T00:00:00Z"),
      }) as never
    );
    mockExtendSubscriptionTrial.mockResolvedValue({} as never);

    const result = await extendPremiumTrial({
      stripeSubscriptionId: "sub_test",
      months: 3,
    });

    expect(result.months).toBe(3);
    expect(result.stripeSubscriptionId).toBe("sub_test");
    expect(result.previousTrialEnd).toBe(null);
    expect(result.newTrialEnd.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(mockExtendSubscriptionTrial).toHaveBeenCalledWith({
      subscriptionId: "sub_test",
      newTrialEnd: expect.any(Date),
    });
  });

  it("extends a trialing subscription by stacking on existing trial_end", async () => {
    mockGetSubscription.mockResolvedValue(
      makeSub({
        status: "trialing",
        periodEnd: new Date("2026-05-01T00:00:00Z"),
        trialEnd: new Date("2026-08-01T00:00:00Z"),
      }) as never
    );
    mockExtendSubscriptionTrial.mockResolvedValue({} as never);

    const result = await extendPremiumTrial({
      stripeSubscriptionId: "sub_test",
      months: 3,
    });

    expect(result.previousTrialEnd?.toISOString().slice(0, 10)).toBe(
      "2026-08-01"
    );
    expect(result.newTrialEnd.toISOString().slice(0, 10)).toBe("2026-11-01");
  });

  it("rejects past_due subscriptions", async () => {
    mockGetSubscription.mockResolvedValue(
      makeSub({
        status: "past_due",
        periodEnd: new Date("2026-05-01T00:00:00Z"),
      }) as never
    );

    await expect(
      extendPremiumTrial({ stripeSubscriptionId: "sub_test", months: 1 })
    ).rejects.toThrow(/past_due/);
    expect(mockExtendSubscriptionTrial).not.toHaveBeenCalled();
  });

  it("rejects canceled subscriptions", async () => {
    mockGetSubscription.mockResolvedValue(
      makeSub({
        status: "canceled",
        periodEnd: new Date("2026-05-01T00:00:00Z"),
      }) as never
    );

    await expect(
      extendPremiumTrial({ stripeSubscriptionId: "sub_test", months: 1 })
    ).rejects.toThrow(/canceled/);
  });

  it("rejects zero or negative months", async () => {
    await expect(
      extendPremiumTrial({ stripeSubscriptionId: "sub_test", months: 0 })
    ).rejects.toThrow(PremiumCompError);
    await expect(
      extendPremiumTrial({ stripeSubscriptionId: "sub_test", months: -1 })
    ).rejects.toThrow(PremiumCompError);
    expect(mockGetSubscription).not.toHaveBeenCalled();
  });

  it("rejects months greater than 24", async () => {
    await expect(
      extendPremiumTrial({ stripeSubscriptionId: "sub_test", months: 25 })
    ).rejects.toThrow(PremiumCompError);
  });

  it("rejects non-integer months", async () => {
    await expect(
      extendPremiumTrial({ stripeSubscriptionId: "sub_test", months: 1.5 })
    ).rejects.toThrow(PremiumCompError);
  });

  it("rejects missing subscription id", async () => {
    await expect(
      extendPremiumTrial({ stripeSubscriptionId: "", months: 1 })
    ).rejects.toThrow(PremiumCompError);
  });
});
