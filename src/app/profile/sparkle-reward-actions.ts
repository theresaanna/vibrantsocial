"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited, sparkleRewardLimiter } from "@/lib/rate-limit";

/**
 * Stars awarded per successful sparkle click. Combined with the rate
 * limiter (5 claims per 24h, see rate-limit.ts), the daily ceiling is
 * STARS_PER_CLICK * 5. Current total: 5 stars/day.
 */
const STARS_PER_CLICK = 1;

export type SparkleRewardResult =
  | { ok: true; awarded: number; total: number }
  | { ok: false; error: "unauthorized" | "rate_limited" };

/**
 * Awards stars to the current user for clicking a raining sparkle.
 * Rate-limited to prevent farming. Silently fails closed if rate limited
 * so the UI can just no-op without nagging the user.
 */
export async function claimSparkleReward(): Promise<SparkleRewardResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const limited = await isRateLimited(
    sparkleRewardLimiter,
    `sparkle:${session.user.id}`
  );
  if (limited) {
    return { ok: false, error: "rate_limited" };
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { stars: { increment: STARS_PER_CLICK } },
    select: { stars: true },
  });

  return { ok: true, awarded: STARS_PER_CLICK, total: updated.stars };
}
