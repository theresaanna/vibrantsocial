import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY must be set");
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

/**
 * Creates a Stripe Checkout Session for age verification payment.
 */
export async function createCheckoutSession(params: {
  userId: string;
  userEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    throw new Error("STRIPE_PRICE_ID must be set");
  }

  return stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.userEmail ?? undefined,
    client_reference_id: params.userId,
    metadata: {
      userId: params.userId,
      purpose: "age_verification",
    },
  });
}

/**
 * Retrieves a Checkout Session by ID.
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Creates a Stripe Checkout Session for premium subscription.
 */
export async function createPremiumCheckoutSession(params: {
  userId: string;
  userEmail?: string | null;
  stripeCustomerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;

  if (!priceId) {
    throw new Error("STRIPE_PREMIUM_PRICE_ID must be set");
  }

  return stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    ...(params.stripeCustomerId
      ? { customer: params.stripeCustomerId }
      : { customer_email: params.userEmail ?? undefined }),
    client_reference_id: params.userId,
    metadata: {
      userId: params.userId,
      purpose: "premium_subscription",
    },
  });
}

/**
 * Creates a Stripe Billing Portal session for managing subscriptions.
 */
export async function createBillingPortalSession(params: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl,
  });
}

/**
 * Retrieves a subscription by ID.
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Extends a subscription's trial_end to the given timestamp, effectively
 * comping the user free time until that date. Uses `proration_behavior=none`
 * so the customer is not billed for the extension.
 *
 * Does NOT work on subscriptions managed by a subscription schedule — those
 * must go through `extendSubscriptionScheduleTrial` instead. The caller is
 * expected to branch on `subscription.schedule`.
 */
export async function extendSubscriptionTrial(params: {
  subscriptionId: string;
  newTrialEnd: Date;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.update(params.subscriptionId, {
    trial_end: Math.floor(params.newTrialEnd.getTime() / 1000),
    proration_behavior: "none",
  });
}

/**
 * Retrieves a subscription schedule by ID.
 */
export async function getSubscriptionSchedule(
  scheduleId: string
): Promise<Stripe.SubscriptionSchedule> {
  const stripe = getStripe();
  return stripe.subscriptionSchedules.retrieve(scheduleId);
}

/**
 * Extends free time on a subscription managed by a schedule.
 *
 * When a Stripe subscription is attached to a `subscription_schedule`, its
 * `trial_end` can't be edited on the subscription directly — the schedule
 * governs the phases. To comp additional free months, we mutate the schedule's
 * LAST phase:
 *
 * - If the last phase is already a trial phase, we push its `end_date` forward.
 * - If the last phase is a paid phase, we append a new trial phase that runs
 *   from the old last-phase end to `newEndDate`, reusing the same line items.
 *
 * Either way, the subscription's free time is extended until `newEndDate` and
 * the schedule's `end_behavior` (usually `release`) is preserved. Past and
 * current phases are passed through untouched.
 *
 * This helper is intentionally a thin Stripe wrapper: it takes a pre-computed
 * `newEndDate` rather than a month count so all calendar math stays in
 * `@/lib/premium-comps`.
 */
export async function extendSubscriptionScheduleTrial(params: {
  scheduleId: string;
  newEndDate: Date;
}): Promise<{
  schedule: Stripe.SubscriptionSchedule;
  previousEndDate: Date;
  newEndDate: Date;
  appendedTrialPhase: boolean;
}> {
  const stripe = getStripe();
  const schedule = await stripe.subscriptionSchedules.retrieve(
    params.scheduleId
  );

  if (schedule.status !== "active" && schedule.status !== "not_started") {
    throw new Error(
      `Subscription schedule status is "${schedule.status}"; only active or not_started schedules can be extended`
    );
  }

  const phases = schedule.phases;
  if (!phases || phases.length === 0) {
    throw new Error("Subscription schedule has no phases");
  }

  const lastIdx = phases.length - 1;
  const lastPhase = phases[lastIdx];
  if (typeof lastPhase.end_date !== "number") {
    throw new Error("Last phase has no end_date — cannot extend");
  }
  const previousEndDate = new Date(lastPhase.end_date * 1000);
  const newEndTs = Math.floor(params.newEndDate.getTime() / 1000);

  if (newEndTs <= lastPhase.end_date) {
    throw new Error(
      "newEndDate must be after the current last-phase end_date"
    );
  }

  // Serialize every phase back into the update-params shape. Stripe requires
  // us to pass all phases (past, current, future); past/current phases are
  // matched by start_date and must keep their original items.
  const serialized: Stripe.SubscriptionScheduleUpdateParams.Phase[] = phases.map(
    (phase) => serializePhaseForUpdate(phase)
  );

  // `phase.trial` is present in the JSON response but missing from the
  // stripe-node@20.4.1 type. Cast through a loose shape for the read.
  const lastPhaseIsTrial =
    (lastPhase as unknown as { trial?: boolean }).trial === true;
  let appendedTrialPhase = false;

  if (lastPhaseIsTrial) {
    // Extend the existing trial phase's end_date.
    serialized[lastIdx].end_date = newEndTs;
  } else {
    // Append a new trial phase from the old end to the new end, reusing the
    // same line items so billing picks up at the same price after release.
    const newTrialPhase: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: serialized[lastIdx].items,
      start_date: lastPhase.end_date,
      end_date: newEndTs,
      trial: true,
    };
    serialized.push(newTrialPhase);
    appendedTrialPhase = true;
  }

  const updated = await stripe.subscriptionSchedules.update(params.scheduleId, {
    phases: serialized,
    proration_behavior: "none",
  });

  return {
    schedule: updated,
    previousEndDate,
    newEndDate: params.newEndDate,
    appendedTrialPhase,
  };
}

/**
 * Converts a retrieved subscription schedule phase into the minimal shape
 * accepted by `subscriptionSchedules.update`. We preserve start_date/end_date
 * (so Stripe can match past phases) and reduce each item to `{ price, quantity }`
 * (stripping expanded fields like `plan`, `tax_rates` that the update endpoint
 * rejects or deprecates).
 *
 * Stripe's update API rejects specifying BOTH `trial: true` and `trial_end` on
 * the same phase — even though retrieve responses may echo both. We prefer
 * `trial: true` when present (it means "the whole phase is a trial") and only
 * fall back to `trial_end` (a partial-phase trial cutoff) when `trial` is not
 * set.
 */
export function serializePhaseForUpdate(
  phase: Stripe.SubscriptionSchedule.Phase
): Stripe.SubscriptionScheduleUpdateParams.Phase {
  const out: Stripe.SubscriptionScheduleUpdateParams.Phase = {
    items: phase.items.map((it) => {
      const priceId =
        typeof it.price === "string" ? it.price : (it.price as Stripe.Price).id;
      return { price: priceId, quantity: it.quantity ?? 1 };
    }),
    start_date: phase.start_date,
    end_date: phase.end_date ?? undefined,
  };
  const loose = phase as unknown as { trial?: boolean; trial_end?: number };
  if (loose.trial) {
    out.trial = true;
  } else if (typeof loose.trial_end === "number") {
    out.trial_end = loose.trial_end;
  }
  return out;
}

/**
 * Constructs and verifies a Stripe webhook event from the raw body and signature.
 */
export function constructWebhookEvent(
  body: string,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET must be set");
  }

  return stripe.webhooks.constructEvent(body, signature, webhookSecret);
}
