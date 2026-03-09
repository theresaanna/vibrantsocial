"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface VerifyEmailState {
  success: boolean;
  message: string;
}

export async function verifyEmail(
  token: string,
  email: string
): Promise<VerifyEmailState> {
  if (!token || !email) {
    return { success: false, message: "Invalid verification link." };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const verificationToken = await prisma.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier: `email-verify:${normalizedEmail}`,
        token,
      },
    },
  });

  if (!verificationToken) {
    return {
      success: false,
      message: "Invalid or expired verification link.",
    };
  }

  if (verificationToken.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: `email-verify:${normalizedEmail}`,
          token,
        },
      },
    });
    return {
      success: false,
      message:
        "This verification link has expired. Please request a new one from your profile settings.",
    };
  }

  // Find the user who requested this email change
  const user = await prisma.user.findFirst({
    where: { pendingEmail: normalizedEmail },
  });

  if (!user) {
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: `email-verify:${normalizedEmail}`,
          token,
        },
      },
    });
    return {
      success: false,
      message: "No pending email change found for this address.",
    };
  }

  // Check if the email was taken by someone else in the meantime
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser && existingUser.id !== user.id) {
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: `email-verify:${normalizedEmail}`,
          token,
        },
      },
    });
    return {
      success: false,
      message: "This email address is no longer available.",
    };
  }

  // Update the user's email
  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: normalizedEmail,
      emailVerified: new Date(),
      pendingEmail: null,
    },
  });

  // Clean up the token
  await prisma.verificationToken.delete({
    where: {
      identifier_token: {
        identifier: `email-verify:${normalizedEmail}`,
        token,
      },
    },
  });

  revalidatePath("/profile");
  return {
    success: true,
    message: "Your email address has been verified!",
  };
}
