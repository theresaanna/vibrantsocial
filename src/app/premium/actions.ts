"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createPremiumCheckoutSession,
  createBillingPortalSession,
} from "@/lib/stripe";
import { requireAuthWithRateLimit, isActionError } from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";

export async function createPremiumSubscription(): Promise<ActionState & { url?: string }> {
  const result = await requireAuthWithRateLimit("premium");
  if (isActionError(result)) return result;
  const session = result;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      tier: true,
      stripeCustomerId: true,
    },
  });

  if (!user) {
    return { success: false, message: "User not found" };
  }

  if (user.tier === "premium") {
    return { success: false, message: "Already subscribed to premium" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return { success: false, message: "Server configuration error" };
  }

  try {
    const checkoutSession = await createPremiumCheckoutSession({
      userId: session.user.id,
      userEmail: user.email,
      stripeCustomerId: user.stripeCustomerId,
      successUrl: `${appUrl}/premium?success=true`,
      cancelUrl: `${appUrl}/premium?canceled=true`,
    });

    return {
      success: true,
      message: "Checkout session created",
      url: checkoutSession.url ?? undefined,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create checkout session";
    return { success: false, message };
  }
}

export async function createBillingPortal(): Promise<ActionState & { url?: string }> {
  const result = await requireAuthWithRateLimit("premium");
  if (isActionError(result)) return result;
  const session = result;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return { success: false, message: "No active subscription found" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return { success: false, message: "Server configuration error" };
  }

  try {
    const portalSession = await createBillingPortalSession({
      stripeCustomerId: user.stripeCustomerId,
      returnUrl: `${appUrl}/premium`,
    });

    return {
      success: true,
      message: "Billing portal session created",
      url: portalSession.url,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create billing portal session";
    return { success: false, message };
  }
}
