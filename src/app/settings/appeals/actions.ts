"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendStrikeAppealEmail } from "@/lib/email";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";

interface AppealState {
  success: boolean;
  message: string;
}

export async function submitStrikeAppeal(
  _prevState: AppealState,
  formData: FormData
): Promise<AppealState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `appeal:${session.user.id}`)) {
    return { success: false, message: "Too many attempts. Please try again later." };
  }

  const violationId = formData.get("violationId") as string;
  const reason = formData.get("reason") as string;

  if (!violationId) {
    return { success: false, message: "Violation ID is required" };
  }

  if (!reason || reason.trim().length < 10) {
    return { success: false, message: "Please provide a reason (at least 10 characters)" };
  }

  if (reason.length > 2000) {
    return { success: false, message: "Reason must be under 2000 characters" };
  }

  const violation = await prisma.contentViolation.findUnique({
    where: { id: violationId },
    include: {
      user: { select: { id: true, username: true, email: true } },
    },
  });

  if (!violation || violation.userId !== session.user.id) {
    return { success: false, message: "Violation not found" };
  }

  await sendStrikeAppealEmail({
    username: violation.user.username ?? "unknown",
    userEmail: violation.user.email ?? "unknown",
    violationId: violation.id,
    violationType: violation.type,
    postId: violation.postId,
    reason: reason.trim(),
  });

  return { success: true, message: "Your appeal has been submitted. We will review it and get back to you." };
}

export async function getUserViolations() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.contentViolation.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      confidence: true,
      action: true,
      postId: true,
      createdAt: true,
    },
  });
}
