import { describe, it, expect } from "vitest";
import { serializePhaseForUpdate } from "@/lib/stripe";

/**
 * Regression tests for the phase serializer used when extending a
 * subscription_schedule. The tricky bit is that Stripe's retrieve response
 * echoes redundant trial metadata (both `trial: true` and `trial_end` equal
 * to `end_date`) that the update endpoint rejects when both are set.
 */
describe("serializePhaseForUpdate", () => {
  // Minimal shape we care about; cast through unknown to match the
  // private Stripe type the helper expects.
  function makePhase(overrides: {
    trial?: boolean;
    trial_end?: number;
    start_date?: number;
    end_date?: number;
    items?: Array<{ price: string | { id: string }; quantity?: number }>;
  }) {
    return {
      start_date: overrides.start_date ?? 1_700_000_000,
      end_date: overrides.end_date ?? 1_702_592_000,
      items: overrides.items ?? [{ price: "price_test", quantity: 1 }],
      trial: overrides.trial,
      trial_end: overrides.trial_end,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  it("drops trial_end when trial is true (Stripe rejects both)", () => {
    const out = serializePhaseForUpdate(
      makePhase({
        trial: true,
        trial_end: 1_702_592_000, // echoed by Stripe retrieve, equals end_date
      })
    );

    expect(out.trial).toBe(true);
    expect(out.trial_end).toBeUndefined();
  });

  it("keeps trial_end when trial is not set (partial-phase trial cutoff)", () => {
    const out = serializePhaseForUpdate(
      makePhase({
        trial: undefined,
        trial_end: 1_701_000_000,
      })
    );

    expect(out.trial).toBeUndefined();
    expect(out.trial_end).toBe(1_701_000_000);
  });

  it("omits both when neither is set (paid phase)", () => {
    const out = serializePhaseForUpdate(
      makePhase({ trial: undefined, trial_end: undefined })
    );

    expect(out.trial).toBeUndefined();
    expect(out.trial_end).toBeUndefined();
  });

  it("reduces items to { price, quantity } and resolves expanded price objects", () => {
    const out = serializePhaseForUpdate(
      makePhase({
        items: [
          { price: "price_a" },
          { price: { id: "price_b" }, quantity: 2 },
        ],
      })
    );

    expect(out.items).toEqual([
      { price: "price_a", quantity: 1 },
      { price: "price_b", quantity: 2 },
    ]);
  });

  it("preserves start_date and end_date so Stripe can match past phases", () => {
    const out = serializePhaseForUpdate(
      makePhase({ start_date: 1_774_654_607, end_date: 1_776_700_701 })
    );

    expect(out.start_date).toBe(1_774_654_607);
    expect(out.end_date).toBe(1_776_700_701);
  });
});
