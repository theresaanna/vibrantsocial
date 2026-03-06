"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

interface SignupState {
  success: boolean;
  message: string;
}

export async function signup(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const dateOfBirthStr = formData.get("dateOfBirth") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!email || !dateOfBirthStr || !password || !confirmPassword) {
    return { success: false, message: "All fields are required" };
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

  if (age < 13) {
    return { success: false, message: "You must be at least 13 years old to sign up" };
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

  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      dateOfBirth,
      emailVerified: new Date(),
    },
  });

  // Auto-friend with theresa so new users see content and have a connection
  try {
    const theresa = await prisma.user.findUnique({
      where: { username: "theresa" },
      select: { id: true },
    });
    if (theresa && theresa.id !== newUser.id) {
      await prisma.$transaction([
        prisma.follow.create({
          data: { followerId: newUser.id, followingId: theresa.id },
        }),
        prisma.follow.create({
          data: { followerId: theresa.id, followingId: newUser.id },
        }),
      ]);
    }
  } catch {
    // Non-critical — don't block signup if auto-friend fails
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/profile",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, message: "Account created but sign-in failed" };
    }
    throw error; // Re-throw NEXT_REDIRECT
  }

  return { success: true, message: "Account created" };
}
