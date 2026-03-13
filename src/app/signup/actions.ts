"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { autoFriendNewUser } from "@/lib/auto-friend";
import { inngest } from "@/lib/inngest";
import { sendEmailVerificationEmail } from "@/lib/email";

interface SignupState {
  success: boolean;
  message: string;
}

export async function signup(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const dateOfBirthStr = formData.get("dateOfBirth") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const agreeToTos = formData.get("agreeToTos") as string;

  if (!email || !username || !dateOfBirthStr || !password || !confirmPassword) {
    return { success: false, message: "All fields are required" };
  }

  if (agreeToTos !== "true") {
    return {
      success: false,
      message: "You must agree to the Terms of Service and Privacy Policy",
    };
  }

  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return {
      success: false,
      message:
        "Username must be 3-30 characters, letters, numbers, and underscores only",
    };
  }

  const dateOfBirth = new Date(dateOfBirthStr);
  if (isNaN(dateOfBirth.getTime())) {
    return { success: false, message: "Invalid date of birth" };
  }

  if (dateOfBirth > new Date()) {
    return { success: false, message: "Date of birth cannot be in the future" };
  }

  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }

  if (age < 18) {
    return { success: false, message: "You must be at least 18 years old to sign up" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: "Invalid email address" };
  }

  if (password.length < 8) {
    return {
      success: false,
      message: "Password must be at least 8 characters",
    };
  }

  if (password !== confirmPassword) {
    return { success: false, message: "Passwords do not match" };
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

  const newUser = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      dateOfBirth,
      pendingEmail: email,
    },
  });

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
