"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { authLimiter, isRateLimited } from "@/lib/rate-limit";

interface SetPasswordState {
  success: boolean;
  message: string;
}

/**
 * Completion half of the "add a password" flow kicked off by
 * `requestPasswordSetupEmail()`. Verifies the one-time token, confirms
 * the user is still password-less (race guard), hashes the new
 * password, and writes it to `User.passwordHash`.
 *
 * Tokens for this flow live in `VerificationToken` with an identifier
 * of `set-password:<email>` — distinct from the plain-email identifier
 * the password-reset flow uses, so the two can coexist without
 * stepping on each other.
 */
export async function setInitialPassword(
  _prevState: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (await isRateLimited(authLimiter, `set-password:${ip}`)) {
    return {
      success: false,
      message: "Too many attempts. Please try again later.",
    };
  }

  const token = formData.get("token") as string;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token || !email) {
    return { success: false, message: "Invalid setup link" };
  }
  if (!password || password.length < 8) {
    return { success: false, message: "Password must be at least 8 characters" };
  }
  if (password !== confirmPassword) {
    return { success: false, message: "Passwords do not match" };
  }

  const identifier = `set-password:${email}`;

  const verificationToken = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier, token } },
  });
  if (!verificationToken) {
    return {
      success: false,
      message: "Invalid or expired setup link. Please request a new one.",
    };
  }
  if (verificationToken.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier, token } },
    });
    return {
      success: false,
      message: "This setup link has expired. Please request a new one.",
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return {
      success: false,
      message: "Invalid or expired setup link. Please request a new one.",
    };
  }
  // Race guard: someone could have set a password via another channel
  // between the request and the submit. Don't clobber a password that
  // now exists; send them to the reset flow instead.
  if (user.passwordHash) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier, token } },
    });
    return {
      success: false,
      message:
        "A password is already set on this account. Use the reset flow " +
        "if you need to change it.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier, token } },
  });

  return {
    success: true,
    message: "Password set! You can now sign in with your email and password.",
  };
}
