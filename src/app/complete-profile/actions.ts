"use server";

import crypto from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { sendEmailVerificationEmail } from "@/lib/email";

interface CompleteProfileState {
  success: boolean;
  message: string;
}

export async function completeProfile(
  _prevState: CompleteProfileState,
  formData: FormData
): Promise<CompleteProfileState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const dateOfBirthStr = formData.get("dateOfBirth") as string;

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, email: true, dateOfBirth: true },
  });

  // Build update data based on what's missing
  const updateData: Record<string, unknown> = {};

  // Validate and set username if needed
  if (!currentUser?.username) {
    if (!username) {
      return { success: false, message: "Username is required" };
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return {
        success: false,
        message:
          "Username must be 3-30 characters, letters, numbers, and underscores only",
      };
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername && existingUsername.id !== session.user.id) {
      return { success: false, message: "This username is already taken" };
    }

    updateData.username = username;
  }

  // Validate and set email if needed
  if (!currentUser?.email) {
    if (!email) {
      return { success: false, message: "Email is required" };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, message: "Invalid email address" };
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail && existingEmail.id !== session.user.id) {
      return {
        success: false,
        message: "This email is already associated with another account",
      };
    }

    updateData.email = email;
    updateData.pendingEmail = email;
  }

  // Validate and set dateOfBirth if needed
  if (!currentUser?.dateOfBirth) {
    if (!dateOfBirthStr) {
      return { success: false, message: "Date of birth is required" };
    }

    const dateOfBirth = new Date(dateOfBirthStr);
    if (isNaN(dateOfBirth.getTime())) {
      return { success: false, message: "Invalid date of birth" };
    }

    if (dateOfBirth > new Date()) {
      return {
        success: false,
        message: "Date of birth cannot be in the future",
      };
    }

    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
    ) {
      age--;
    }

    if (age < 18) {
      return {
        success: false,
        message: "You must be at least 18 years old",
      };
    }

    updateData.dateOfBirth = dateOfBirth;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });
  }

  // Send verification email if a new email was set
  if (updateData.email) {
    const newEmail = updateData.email as string;

    // Clean up any existing tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: `email-verify:${newEmail}` },
    });

    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.verificationToken.create({
      data: {
        identifier: `email-verify:${newEmail}`,
        token,
        expires,
      },
    });

    sendEmailVerificationEmail({ toEmail: newEmail, token });
  }

  redirect("/feed");
}
