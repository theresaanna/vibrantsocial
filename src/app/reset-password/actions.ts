"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { authLimiter, isRateLimited } from "@/lib/rate-limit";

interface ResetPasswordState {
  success: boolean;
  message: string;
}

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (await isRateLimited(authLimiter, `reset-password:${ip}`)) {
    return { success: false, message: "Too many attempts. Please try again later." };
  }

  const token = formData.get("token") as string;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token || !email) {
    return { success: false, message: "Invalid reset link" };
  }

  if (!password || password.length < 8) {
    return {
      success: false,
      message: "Password must be at least 8 characters",
    };
  }

  if (password !== confirmPassword) {
    return { success: false, message: "Passwords do not match" };
  }

  const verificationToken = await prisma.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier: email,
        token,
      },
    },
  });

  if (!verificationToken) {
    return {
      success: false,
      message: "Invalid or expired reset link. Please request a new one.",
    };
  }

  if (verificationToken.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: email,
          token,
        },
      },
    });
    return {
      success: false,
      message: "This reset link has expired. Please request a new one.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return {
      success: false,
      message: "Invalid or expired reset link. Please request a new one.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await prisma.verificationToken.delete({
    where: {
      identifier_token: {
        identifier: email,
        token,
      },
    },
  });

  return {
    success: true,
    message: "Password reset successfully! You can now sign in.",
  };
}
