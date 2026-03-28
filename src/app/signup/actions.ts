"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { autoFriendNewUser } from "@/lib/auto-friend";
import { inngest } from "@/lib/inngest";
import { sendEmailVerificationEmail } from "@/lib/email";
import { awardReferralSignupStars } from "@/lib/referral";
import { headers } from "next/headers";
import { authLimiter, isRateLimited } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { signupSchema, parseFormData } from "@/lib/validations";

interface SignupState {
  success: boolean;
  message: string;
}

export async function signup(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (await isRateLimited(authLimiter, `signup:${ip}`)) {
    return { success: false, message: "Too many attempts. Please try again later." };
  }

  // Validate input with Zod
  const parsed = parseFormData(signupSchema, formData, [
    "email", "username", "dateOfBirth", "password", "confirmPassword",
    "agreeToTos", "referralCode", "cf-turnstile-response",
  ]);
  if (!parsed.success) {
    return { success: false, message: parsed.error };
  }

  const { email, username, password, "cf-turnstile-response": turnstileToken } = parsed.data;
  const dateOfBirth = new Date(parsed.data.dateOfBirth);

  // Verify Turnstile CAPTCHA
  if (!(await verifyTurnstileToken(turnstileToken))) {
    return { success: false, message: "CAPTCHA verification failed. Please try again." };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return {
      success: false,
      message: "An account with this email already exists",
    };
  }

  const existingUsername = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUsername) {
    return {
      success: false,
      message: "This username is already taken",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Look up referrer if a referral code was provided
  const referralCode = parsed.data.referralCode;
  let referrerId: string | undefined;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });
    if (referrer) {
      referrerId = referrer.id;
    }
  }

  const newUser = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      dateOfBirth,
      pendingEmail: email,
      ...(referrerId ? { referredById: referrerId } : {}),
    },
  });

  // Award referrer 50 stars for the signup
  if (referrerId) {
    await awardReferralSignupStars(referrerId, newUser.id);
  }

  // Auto-friend with theresa so new users see content and have a connection
  await autoFriendNewUser(newUser.id);

  // Send welcome email via background job
  await inngest.send({
    name: "email/welcome",
    data: { toEmail: email },
  });

  // Send email verification
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.verificationToken.create({
    data: {
      identifier: `email-verify:${email}`,
      token,
      expires,
    },
  });

  sendEmailVerificationEmail({ toEmail: email, token });

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/feed",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, message: "Account created but sign-in failed" };
    }
    throw error; // Re-throw NEXT_REDIRECT
  }

  return { success: true, message: "Account created" };
}
