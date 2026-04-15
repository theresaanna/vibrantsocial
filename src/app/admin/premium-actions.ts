"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { extendPremiumTrial, PremiumCompError } from "@/lib/premium-comps";

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
