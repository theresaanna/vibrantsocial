import {
  getSubscription,
  extendSubscriptionTrial,
  extendSubscriptionScheduleTrial,
  getSubscriptionSchedule,
} from "@/lib/stripe";

/**
 * Stripe subscription statuses that are eligible for comping free months.
 * We only extend subs that are currently billing normally or already in trial.
 * Refusing to extend `past_due`, `canceled`, `incomplete`, etc., keeps the
 * semantics of "free time on top of paid time" unambiguous.
 */
const EXTENDABLE_STATUSES = new Set(["active", "trialing"]);

export class PremiumCompError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "PremiumCompError";
  }
}

/**
 * Adds N calendar months to a date. Clamps the day-of-month to the target
 * month's last day, matching Stripe's own month-arithmetic semantics
 * (e.g. Jan 31 + 1 month -> Feb 28/29, not Mar 3).
 */
export function addMonths(date: Date, months: number): Date {
  if (!Number.isInteger(months)) {
    throw new Error("months must be an integer");
  }
  const result = new Date(date.getTime());
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const daysInTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, daysInTargetMonth));
  return result;
}

/**
 * Extracts the subscription's current period end. In recent Stripe API
 * versions `current_period_end` lives on each subscription item, not on
 * the top-level subscription. We take the earliest item's period end as
 * the subscription's effective end-of-period.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCurrentPeriodEnd(subscription: any): Date | null {
  const topLevel = subscription?.current_period_end;
  if (typeof topLevel === "number") {
    return new Date(topLevel * 1000);
  }
  const items = subscription?.items?.data ?? [];
  const itemEnds = items
    .map((it: { current_period_end?: number }) => it.current_period_end)
    .filter((x: number | undefined): x is number => typeof x === "number");
  if (itemEnds.length === 0) return null;
  return new Date(Math.min(...itemEnds) * 1000);
}

/**
 * Computes the new trial_end for extending a subscription by N months.
 * Anchors on the later of (current trial_end, current period end) so
 * stacking a second comp onto an already-extended sub works correctly.
 */
export function computeNewTrialEnd(
  subscription: {
    trial_end?: number | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items?: { data: any[] };
    current_period_end?: number | null;
  },
  months: number
): { anchor: Date; newTrialEnd: Date } {
  const currentTrialEnd =
    typeof subscription.trial_end === "number"
      ? new Date(subscription.trial_end * 1000)
      : null;
  const periodEnd = getCurrentPeriodEnd(subscription);
  const candidates = [currentTrialEnd, periodEnd].filter(
    (d): d is Date => d instanceof Date && !Number.isNaN(d.getTime())
  );
  if (candidates.length === 0) {
    throw new PremiumCompError(
      "no_anchor",
      "Subscription has no current_period_end or trial_end to anchor on"
    );
  }
  const anchor = new Date(Math.max(...candidates.map((d) => d.getTime())));
  return { anchor, newTrialEnd: addMonths(anchor, months) };
}

export interface ExtendPremiumResult {
  stripeSubscriptionId: string;
  previousTrialEnd: Date | null;
  newTrialEnd: Date;
  months: number;
  status: string;
}

/**
 * Computes the new `premiumExpiresAt` value for granting/comping premium
 * months to a user who is NOT backed by a Stripe subscription.
 *
 * Stacks on top of any existing future expiry so multiple comps add up
 * linearly. If the user has no expiry, or their current expiry is in the
 * past, the clock starts from `now`.
 */
export function computeNewPremiumExpiry(
  currentExpiry: Date | null,
  months: number,
  now: Date = new Date()
): { anchor: Date; newExpiry: Date } {
  if (!Number.isInteger(months) || months <= 0 || months > 24) {
    throw new PremiumCompError(
      "invalid_months",
      "months must be an integer between 1 and 24"
    );
  }
  const effectiveCurrent =
    currentExpiry && currentExpiry.getTime() > now.getTime()
      ? currentExpiry
      : now;
  const newExpiry = addMonths(effectiveCurrent, months);
  return { anchor: effectiveCurrent, newExpiry };
}

/**
 * Comps `months` free months onto an active Stripe subscription by pushing
 * its `trial_end` forward. No Prisma writes happen here; the caller is
 * responsible for the audit log (see `extendPremium` server action).
 */
export async function extendPremiumTrial(params: {
  stripeSubscriptionId: string;
  months: number;
}): Promise<ExtendPremiumResult> {
  const { stripeSubscriptionId, months } = params;

  if (!stripeSubscriptionId) {
    throw new PremiumCompError(
      "missing_subscription",
      "No Stripe subscription ID provided"
    );
  }
  if (!Number.isInteger(months) || months <= 0 || months > 24) {
    throw new PremiumCompError(
      "invalid_months",
      "months must be an integer between 1 and 24"
    );
  }

  const subscription = await getSubscription(stripeSubscriptionId);
  if (!EXTENDABLE_STATUSES.has(subscription.status)) {
    throw new PremiumCompError(
      "bad_status",
      `Subscription status is "${subscription.status}"; only active or trialing subscriptions can be extended`
    );
  }

  // Subscriptions attached to a schedule can't have `trial_end` edited on
  // the sub directly — we have to mutate the schedule's phases. Stack on top
  // of whatever the schedule currently queues up as the last phase's end.
  const scheduleId =
    typeof subscription.schedule === "string"
      ? subscription.schedule
      : subscription.schedule?.id ?? null;

  if (scheduleId) {
    const schedule = await getSubscriptionSchedule(scheduleId);
    const lastPhase = schedule.phases?.[schedule.phases.length - 1];
    if (!lastPhase || typeof lastPhase.end_date !== "number") {
      throw new PremiumCompError(
        "no_anchor",
        "Subscription schedule has no extendable last phase"
      );
    }
    const previousEndDate = new Date(lastPhase.end_date * 1000);
    const newEndDate = addMonths(previousEndDate, months);

    await extendSubscriptionScheduleTrial({
      scheduleId,
      newEndDate,
    });

    return {
      stripeSubscriptionId,
      previousTrialEnd: previousEndDate,
      newTrialEnd: newEndDate,
      months,
      status: subscription.status,
    };
  }

  const previousTrialEnd =
    typeof subscription.trial_end === "number"
      ? new Date(subscription.trial_end * 1000)
      : null;

  const { newTrialEnd } = computeNewTrialEnd(subscription, months);

  await extendSubscriptionTrial({
    subscriptionId: stripeSubscriptionId,
    newTrialEnd,
  });

  return {
    stripeSubscriptionId,
    previousTrialEnd,
    newTrialEnd,
    months,
    status: subscription.status,
  };
}
