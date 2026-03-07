"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

interface ForgotPasswordState {
  success: boolean;
  message: string;
}

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!email) {
    return { success: false, message: "Email is required" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: "Invalid email address" };
  }

  const successMessage =
    "If an account with that email exists, we sent you a reset link.";

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // If no user, or user has no password (OAuth-only), still return success
  if (!user || !user.passwordHash) {
    return { success: true, message: successMessage };
  }

  // Clean up any existing tokens for this user
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  // Fire-and-forget
  sendPasswordResetEmail({ toEmail: email, token });

  return { success: true, message: successMessage };
}
