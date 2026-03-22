import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { constructWebhookEvent } from "@/lib/stripe";
import { sendPremiumWelcomeEmail } from "@/lib/email";

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Stripe webhook handler.
 * Receives POST requests when payment events occur.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 401 }
    );
  }

  const bodyText = await request.text();

  let event;
  try {
    event = constructWebhookEvent(bodyText, signature);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Webhook signature verification failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(event.data.object);
  } else if (event.type === "invoice.payment_succeeded") {
    await handleInvoicePaymentSucceeded(event.data.object);
  } else if (event.type === "invoice.payment_failed") {
    await handleInvoicePaymentFailed(event.data.object);
  } else if (event.type === "customer.subscription.deleted") {
    await handleSubscriptionDeleted(event.data.object);
  }

  return NextResponse.json({ received: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCheckoutCompleted(session: any) {
  const purpose = session.metadata?.purpose;

  if (purpose === "age_verification") {
    return handleAgeVerificationCheckout(session);
  }

  if (purpose === "premium_subscription") {
    return handlePremiumCheckoutCompleted(session);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAgeVerificationCheckout(session: any) {
  const userId =
    session.client_reference_id ?? session.metadata?.userId;
  if (!userId) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ageVerificationPaid: true },
  });

  if (!user || user.ageVerificationPaid) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      ageVerificationPaid: new Date(),
      stripeCheckoutSessionId: session.id,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handlePremiumCheckoutCompleted(session: any) {
  const userId =
    session.client_reference_id ?? session.metadata?.userId;
  if (!userId) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeSubscriptionId: true, email: true },
  });

  if (!user) return;

  // Idempotent: skip if already has this subscription
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (user.stripeSubscriptionId === subscriptionId) return;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  await prisma.user.update({
    where: { id: userId },
    data: {
      tier: "premium",
      stripeCustomerId: customerId ?? null,
      stripeSubscriptionId: subscriptionId ?? null,
      premiumExpiresAt: null,
    },
  });

  // Send premium welcome email with free age verification coupon
  if (user.email) {
    await sendPremiumWelcomeEmail({ toEmail: user.email });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleInvoicePaymentSucceeded(invoice: any) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true, tier: true, premiumExpiresAt: true },
  });

  if (!user) return;

  // Clear any grace period and ensure premium is active
  if (user.premiumExpiresAt || user.tier !== "premium") {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        tier: "premium",
        premiumExpiresAt: null,
      },
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleInvoicePaymentFailed(invoice: any) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true, tier: true },
  });

  if (!user || user.tier !== "premium") return;

  // Set 7-day grace period
  await prisma.user.update({
    where: { id: user.id },
    data: {
      premiumExpiresAt: new Date(Date.now() + GRACE_PERIOD_MS),
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleSubscriptionDeleted(subscription: any) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) return;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });

  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      tier: "free",
      stripeSubscriptionId: null,
      premiumExpiresAt: null,
    },
  });
}
