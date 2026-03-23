import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

const REFERRAL_SIGNUP_BONUS = 50;
const REFERRAL_FIRST_POST_BONUS = 50;
const STARS_REDEEM_THRESHOLD = 500;

/**
 * Awards the referrer 50 stars when a referred user signs up.
 */
export async function awardReferralSignupStars(
  referrerId: string,
  referredUserId: string
) {
  await prisma.user.update({
    where: { id: referrerId },
    data: { stars: { increment: REFERRAL_SIGNUP_BONUS } },
  });

  await createNotification({
    type: "REFERRAL_SIGNUP",
    actorId: referredUserId,
    targetUserId: referrerId,
  });
}

/**
 * If the posting user was referred and hasn't triggered the first-post bonus yet,
 * awards the referrer another 50 stars.
 */
export async function awardReferralFirstPostBonus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredById: true, referralBonusPaid: true },
  });

  if (!user?.referredById || user.referralBonusPaid) return;

  await prisma.user.update({
    where: { id: userId },
    data: { referralBonusPaid: true },
  });

  await prisma.user.update({
    where: { id: user.referredById },
    data: { stars: { increment: REFERRAL_FIRST_POST_BONUS } },
  });
}

/**
 * Creates a notification when a user hits the 500-star milestone.
 * Only fires once — checks for existing STARS_MILESTONE notification.
 */
export async function checkStarsMilestone(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stars: true },
  });

  if (!user || user.stars < STARS_REDEEM_THRESHOLD) return;

  // Check if we already notified this user
  const existing = await prisma.notification.findFirst({
    where: {
      targetUserId: userId,
      type: "STARS_MILESTONE",
    },
  });

  if (existing) return;

  // Use the user as their own actor for system notifications
  await createNotification({
    type: "STARS_MILESTONE",
    actorId: userId,
    targetUserId: userId,
  });
}
