"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";

export interface AppealState {
  success: boolean;
  message: string;
}

export async function submitAppeal(
  _prevState: AppealState,
  formData: FormData
): Promise<AppealState> {
  const session = await auth();
  const type = formData.get("type") as string;
  const reason = (formData.get("reason") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();

  if (!reason) {
    return { success: false, message: "Please explain your appeal." };
  }

  if (reason.length > 2000) {
    return { success: false, message: "Appeal must be 2000 characters or fewer." };
  }

  // For logged-in users appealing content warnings
  if (session?.user?.id) {
    if (await isRateLimited(apiLimiter, `appeal:${session.user.id}`)) {
      return { success: false, message: "Too many submissions. Please try again later." };
    }

    const existingPending = await prisma.appeal.findFirst({
      where: { userId: session.user.id, status: "pending" },
    });
    if (existingPending) {
      return { success: false, message: "You already have a pending appeal. Please wait for it to be reviewed." };
    }

    await prisma.appeal.create({
      data: {
        userId: session.user.id,
        type: type || "content_warning",
        reason,
      },
    });

    return { success: true, message: "Your appeal has been submitted. You will receive a response by email." };
  }

  // For suspended users who can't log in — identify by email
  if (!email) {
    return { success: false, message: "Please provide your account email." };
  }

  if (await isRateLimited(apiLimiter, `appeal:${email}`)) {
    return { success: false, message: "Too many submissions. Please try again later." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, suspended: true },
  });

  if (!user) {
    // Don't reveal whether the email exists
    return { success: true, message: "If an account exists with that email, your appeal has been submitted." };
  }

  const existingPending = await prisma.appeal.findFirst({
    where: { userId: user.id, status: "pending" },
  });
  if (existingPending) {
    return { success: false, message: "You already have a pending appeal. Please wait for it to be reviewed." };
  }

  await prisma.appeal.create({
    data: {
      userId: user.id,
      type: "suspension",
      reason,
    },
  });

  return { success: true, message: "Your appeal has been submitted. You will receive a response by email." };
}
