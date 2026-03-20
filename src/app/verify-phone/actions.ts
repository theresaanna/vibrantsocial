"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationCode, checkVerificationCode } from "@/lib/twilio";
import { revalidatePath } from "next/cache";
import { authLimiter, isRateLimited } from "@/lib/rate-limit";

export interface VerifyState {
  step: "input" | "verify" | "done";
  message: string;
  success: boolean;
}

export async function sendPhoneCode(
  _prevState: VerifyState,
  formData: FormData
): Promise<VerifyState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { step: "input", message: "Not authenticated", success: false };
  }

  if (await isRateLimited(authLimiter, `phone-send:${session.user.id}`)) {
    return { step: "input", message: "Too many attempts. Please try again later.", success: false };
  }

  const countryCode = formData.get("countryCode") as string;
  const localNumber = (formData.get("localNumber") as string).replace(/\D/g, "");
  const phoneNumber = `${countryCode}${localNumber}`;

  if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
    return {
      step: "input",
      message: "Please enter a valid phone number",
      success: false,
    };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { phoneNumber },
  });

  try {
    await sendVerificationCode(phoneNumber);
  } catch {
    return {
      step: "input",
      message: "Failed to send verification code. Please try again.",
      success: false,
    };
  }

  return { step: "verify", message: "Code sent!", success: true };
}

export async function verifyPhoneCode(
  _prevState: VerifyState,
  formData: FormData
): Promise<VerifyState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { step: "input", message: "Not authenticated", success: false };
  }

  if (await isRateLimited(authLimiter, `phone-verify:${session.user.id}`)) {
    return { step: "verify", message: "Too many attempts. Please try again later.", success: false };
  }

  const code = formData.get("code") as string;

  if (!/^\d{4,8}$/.test(code)) {
    return { step: "verify", message: "Enter a valid code", success: false };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.phoneNumber) {
    return { step: "input", message: "No phone number on file", success: false };
  }

  try {
    const result = await checkVerificationCode(user.phoneNumber, code);
    if (result.status !== "approved") {
      return {
        step: "verify",
        message: "Invalid or expired code",
        success: false,
      };
    }
  } catch {
    return {
      step: "verify",
      message: "Verification failed. Please try again.",
      success: false,
    };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { phoneVerified: new Date() },
  });

  revalidatePath("/profile");
  return { step: "done", message: "Phone verified!", success: true };
}
