import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { apiLimiter, checkRateLimit } from "@/lib/rate-limit";

const REDEEM_COST = 500;
const PREMIUM_DAYS = 30;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(apiLimiter, `redeem-stars:${session.user.id}`);
  if (rateLimited) return rateLimited;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stars: true, tier: true, premiumExpiresAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.stars < REDEEM_COST) {
    return NextResponse.json(
      { error: "Not enough stars. You need 500 stars to redeem." },
      { status: 400 }
    );
  }

  // Calculate new premium expiration
  const now = new Date();
  let newExpiry: Date;

  if (
    user.tier === "premium" &&
    user.premiumExpiresAt &&
    new Date(user.premiumExpiresAt) > now
  ) {
    // Extend existing premium
    newExpiry = new Date(
      new Date(user.premiumExpiresAt).getTime() +
        PREMIUM_DAYS * 24 * 60 * 60 * 1000
    );
  } else {
    // Start fresh
    newExpiry = new Date(now.getTime() + PREMIUM_DAYS * 24 * 60 * 60 * 1000);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      stars: { decrement: REDEEM_COST },
      starsSpent: { increment: REDEEM_COST },
      tier: "premium",
      premiumExpiresAt: newExpiry,
    },
  });

  return NextResponse.json({
    success: true,
    premiumExpiresAt: newExpiry.toISOString(),
  });
}
