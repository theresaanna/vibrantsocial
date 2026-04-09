"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { authLimiter, isRateLimited } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { loginSchema, parseFormData } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createPendingTwoFactorToken } from "./two-factor/actions";

interface LoginState {
  success: boolean;
  message: string;
}

export async function loginWithCredentials(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (await isRateLimited(authLimiter, `login:${ip}`)) {
    return { success: false, message: "Too many attempts. Please try again later." };
  }

  // Validate input with Zod
  const parsed = parseFormData(loginSchema, formData, [
    "email", "password", "cf-turnstile-response",
  ]);
  if (!parsed.success) {
    return { success: false, message: parsed.error };
  }

  const { email, password, "cf-turnstile-response": turnstileToken } = parsed.data;

  // Verify Turnstile CAPTCHA
  if (!(await verifyTurnstileToken(turnstileToken))) {
    return { success: false, message: "CAPTCHA verification failed. Please try again." };
  }

  // Check if user has 2FA enabled BEFORE calling signIn
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, passwordHash: true, twoFactorEnabled: true, suspended: true },
  });

  if (!user || !user.passwordHash || user.suspended) {
    // Let signIn handle the error to avoid revealing account existence
    try {
      await signIn("credentials", { email, password, redirectTo: "/complete-profile" });
      return { success: true, message: "" };
    } catch (error) {
      if (error instanceof AuthError) {
        return { success: false, message: "Invalid email or password" };
      }
      throw error;
    }
  }

  // Verify password ourselves when 2FA is enabled
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return { success: false, message: "Invalid email or password" };
  }

  // If 2FA is enabled, redirect to 2FA challenge page instead of completing sign-in
  if (user.twoFactorEnabled) {
    const pendingToken = createPendingTwoFactorToken(user.id, email.trim().toLowerCase());
    redirect(`/login/two-factor?token=${encodeURIComponent(pendingToken)}`);
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/complete-profile",
    });
    return { success: true, message: "" };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { success: false, message: "Invalid email or password" };
      }
      return { success: false, message: "Something went wrong" };
    }
    throw error; // Re-throw NEXT_REDIRECT
  }
}
