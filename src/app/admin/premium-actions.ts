"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  computeNewPremiumExpiry,
  extendPremiumTrial,
  PremiumCompError,
} from "@/lib/premium-comps";

function requireAdmin(userId: string | undefined): string {
  if (!userId || !isAdmin(userId)) {
    throw new Error("Unauthorized");
  }
  return userId;
}

const ExtendPremiumSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  months: z.coerce.number().int().min(1).max(24),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type ExtendPremiumState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | null;

/**
 * Server action: comp free months on a user's Stripe premium subscription.
 * Uses the useActionState / useFormState convention — returns a state
 * object so the form UI can render inline success/error messages.
 */
export async function extendPremium(
  _prev: ExtendPremiumState,
  formData: FormData
): Promise<ExtendPremiumState> {
  const session = await auth();
  const adminId = requireAdmin(session?.user?.id);

  const parsed = ExtendPremiumSchema.safeParse({
    userId: formData.get("userId"),
    months: formData.get("months"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { userId, months, reason } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      tier: true,
      stripeSubscriptionId: true,
    },
  });

  if (!user) {
    return { ok: false, error: "User not found" };
  }
  if (user.tier !== "premium") {
    return { ok: false, error: "User is not on the premium tier" };
  }
  if (!user.stripeSubscriptionId) {
    return {
      ok: false,
      error:
        "User has no Stripe subscription (comped or non-Stripe premium) — extending trial is not applicable",
    };
  }

  let result;
  try {
    result = await extendPremiumTrial({
      stripeSubscriptionId: user.stripeSubscriptionId,
      months,
    });
  } catch (error) {
    if (error instanceof PremiumCompError) {
      return { ok: false, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Unknown Stripe error";
    return { ok: false, error: `Stripe error: ${message}` };
  }

  await prisma.premiumComp.create({
    data: {
      adminId,
      userId: user.id,
      months,
      stripeSubscriptionId: result.stripeSubscriptionId,
      previousTrialEnd: result.previousTrialEnd,
      newTrialEnd: result.newTrialEnd,
      reason,
    },
  });

  revalidatePath("/admin");

  return {
    ok: true,
    message: `Added ${months} free month${months === 1 ? "" : "s"} to @${user.username ?? user.id}. New trial end: ${result.newTrialEnd.toISOString().slice(0, 10)}`,
  };
}

const GrantPremiumSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "username is required")
    // Usernames in this codebase are already case-insensitive unique; we
    // don't lowercase here because the DB lookup will handle matching.
    .max(50),
  months: z.coerce.number().int().min(1).max(24),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type GrantPremiumState = ExtendPremiumState;

/**
 * Server action: grant N free premium months to a user who is NOT backed
 * by a Stripe subscription. Writes `User.tier = premium` and stacks the
 * new expiry on top of any existing future expiry (or starts from now if
 * none).
 *
 * Rejects:
 *  - Users with a Stripe subscription (admin should use `extendPremium`
 *    so Stripe billing stays in sync).
 *  - Users already on permanent premium (tier=premium, expiresAt=null) —
 *    comping is a no-op and would silently downgrade them to a finite
 *    expiry, which is worse than the current state.
 */
export async function grantPremiumMonths(
  _prev: GrantPremiumState,
  formData: FormData
): Promise<GrantPremiumState> {
  const session = await auth();
  const adminId = requireAdmin(session?.user?.id);

  const parsed = GrantPremiumSchema.safeParse({
    username: formData.get("username"),
    months: formData.get("months"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { username, months, reason } = parsed.data;

  // Case-insensitive username lookup — matches the rest of the codebase's
  // username handling (see /@username routes and auth flows).
  const user = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
    },
    select: {
      id: true,
      username: true,
      tier: true,
      premiumExpiresAt: true,
      stripeSubscriptionId: true,
    },
  });

  if (!user) {
    return { ok: false, error: `User @${username} not found` };
  }
  if (user.stripeSubscriptionId) {
    return {
      ok: false,
      error:
        "User has a Stripe subscription — use the Comp months form on their row instead",
    };
  }
  if (user.tier === "premium" && user.premiumExpiresAt === null) {
    return {
      ok: false,
      error:
        "User is already on permanent premium — comping would silently impose an expiry",
    };
  }

  let newExpiry: Date;
  const previousExpiry = user.premiumExpiresAt;
  try {
    ({ newExpiry } = computeNewPremiumExpiry(
      previousExpiry ?? null,
      months
    ));
  } catch (error) {
    if (error instanceof PremiumCompError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        tier: "premium",
        premiumExpiresAt: newExpiry,
      },
    }),
    prisma.premiumComp.create({
      data: {
        adminId,
        userId: user.id,
        months,
        stripeSubscriptionId: null,
        previousTrialEnd: previousExpiry,
        newTrialEnd: newExpiry,
        reason,
      },
    }),
  ]);

  revalidatePath("/admin");

  return {
    ok: true,
    message: `Granted ${months} free month${months === 1 ? "" : "s"} to @${user.username ?? user.id}. Premium until: ${newExpiry.toISOString().slice(0, 10)}`,
  };
}
