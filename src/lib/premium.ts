import { prisma } from "@/lib/prisma";

/**
 * Checks if a user currently has premium access.
 * Returns true if tier is "premium" AND the grace period hasn't expired.
 */
export function isUserPremium(user: {
  tier: string;
  premiumExpiresAt: Date | null;
}): boolean {
  if (user.tier !== "premium") return false;
  if (user.premiumExpiresAt === null) return true;
  return new Date(user.premiumExpiresAt) > new Date();
}

/**
 * Checks if a user has premium access, and lazily expires it if the
 * grace period has passed. This avoids needing a cron job — premium
 * is revoked at access-time when found to be expired.
 */
export async function checkAndExpirePremium(
  userId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true, premiumExpiresAt: true },
  });

  if (!user) return false;
  if (user.tier !== "premium") return false;

  // No expiry set — premium is fully active
  if (user.premiumExpiresAt === null) return true;

  // Still within grace period
  if (new Date(user.premiumExpiresAt) > new Date()) return true;

  // Grace period expired — revoke premium
  await prisma.user.update({
    where: { id: userId },
    data: {
      tier: "free",
      premiumExpiresAt: null,
    },
  });

  return false;
}
