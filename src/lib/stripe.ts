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
