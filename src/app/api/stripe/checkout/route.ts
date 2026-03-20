import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/stripe";
import { apiLimiter, checkRateLimit } from "@/lib/rate-limit";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(apiLimiter, `stripe-checkout:${session.user.id}`);
  if (rateLimited) return rateLimited;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      ageVerificationPaid: true,
      ageVerified: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.ageVerificationPaid) {
    return NextResponse.json({ error: "Already paid" }, { status: 400 });
  }

  if (user.ageVerified) {
    return NextResponse.json({ error: "Already verified" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const checkoutSession = await createCheckoutSession({
      userId: session.user.id,
      userEmail: user.email,
      successUrl: `${appUrl}/payment?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/payment?canceled=true`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
