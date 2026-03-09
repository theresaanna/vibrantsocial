import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { constructWebhookEvent } from "@/lib/stripe";

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
    const session = event.data.object;

    // Only process age verification payments
    if (session.metadata?.purpose !== "age_verification") {
      return NextResponse.json({ received: true });
    }

    const userId =
      session.client_reference_id ?? session.metadata?.userId;
    if (!userId) {
      return NextResponse.json({ received: true });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ageVerificationPaid: true },
    });

    if (!user) {
      return NextResponse.json({ received: true });
    }

    // Idempotent: skip if already paid
    if (user.ageVerificationPaid) {
      return NextResponse.json({ received: true });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        ageVerificationPaid: new Date(),
        stripeCheckoutSessionId: session.id,
      },
    });
  }

  return NextResponse.json({ received: true });
}
