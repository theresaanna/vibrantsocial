"use server";

import { prisma } from "@/lib/prisma";
import { requireAuthWithRateLimit, isActionError } from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";
import bcrypt from "bcryptjs";
import {
  generateTOTPSecret,
  getTOTPUri,
  verifyTOTPCode,
  encryptSecret,
  decryptSecret,
  generateBackupCodes,
  hashBackupCodes,
} from "@/lib/two-factor";
import { revalidatePath } from "next/cache";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface TwoFactorSetupResult extends ActionState {
  secret?: string;
  uri?: string;
}

export interface TwoFactorEnableResult extends ActionState {
  backupCodes?: string[];
}

// --------------------------------------------------------------------------
// Begin TOTP setup — generates secret + URI, stores encrypted pending secret
// --------------------------------------------------------------------------

export async function beginTOTPSetup(): Promise<TwoFactorSetupResult> {
  const result = await requireAuthWithRateLimit("2fa");
  if (isActionError(result)) return result;
  const session = result;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, passwordHash: true, twoFactorEnabled: true },
  });

  if (!user?.passwordHash) {
    return {
      success: false,
      message: "Two-factor authentication requires a password-based account.",
    };
  }

  if (user.twoFactorEnabled) {
    return { success: false, message: "Two-factor authentication is already enabled." };
  }

  const secret = generateTOTPSecret();
  const uri = getTOTPUri(secret, user.email ?? session.user.id);

  // Store the encrypted secret as "pending" — not enabled yet until verified
  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorSecret: encryptSecret(secret) },
  });

  return { success: true, message: "", secret, uri };
}

// --------------------------------------------------------------------------
// Confirm TOTP setup — verify code, enable 2FA, generate backup codes
// --------------------------------------------------------------------------

export async function confirmTOTPSetup(
  code: string
): Promise<TwoFactorEnableResult> {
  const result = await requireAuthWithRateLimit("2fa");
  if (isActionError(result)) return result;
  const session = result;

  if (!code || !/^\d{6}$/.test(code)) {
    return { success: false, message: "Please enter a valid 6-digit code." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!user?.twoFactorSecret) {
    return { success: false, message: "No pending 2FA setup found. Please start again." };
  }

  if (user.twoFactorEnabled) {
    return { success: false, message: "Two-factor authentication is already enabled." };
  }

  const secret = decryptSecret(user.twoFactorSecret);
  if (!verifyTOTPCode(secret, code)) {
    return { success: false, message: "Invalid code. Please try again." };
  }

  // Generate backup codes
  const backupCodes = generateBackupCodes(10);
  const hashedCodes = await hashBackupCodes(backupCodes);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorBackupCodes: hashedCodes,
    },
  });

  revalidatePath("/profile");

  return {
    success: true,
    message: "Two-factor authentication enabled!",
    backupCodes,
  };
}

// --------------------------------------------------------------------------
// Disable TOTP — requires password verification
// --------------------------------------------------------------------------

export async function disableTwoFactor(password: string): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("2fa");
  if (isActionError(result)) return result;
  const session = result;

  if (!password) {
    return { success: false, message: "Password is required." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, twoFactorEnabled: true },
  });

  if (!user?.passwordHash) {
    return { success: false, message: "Cannot verify password." };
  }

  if (!user.twoFactorEnabled) {
    return { success: false, message: "Two-factor authentication is not enabled." };
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return { success: false, message: "Incorrect password." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  });

  // Also remove all passkeys when disabling 2FA
  await prisma.webAuthnCredential.deleteMany({
    where: { userId: session.user.id },
  });

  revalidatePath("/profile");

  return { success: true, message: "Two-factor authentication disabled." };
}

// --------------------------------------------------------------------------
// Regenerate backup codes — requires password
// --------------------------------------------------------------------------

export async function regenerateBackupCodes(
  password: string
): Promise<TwoFactorEnableResult> {
  const result = await requireAuthWithRateLimit("2fa");
  if (isActionError(result)) return result;
  const session = result;

  if (!password) {
    return { success: false, message: "Password is required." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, twoFactorEnabled: true },
  });

  if (!user?.passwordHash) {
    return { success: false, message: "Cannot verify password." };
  }

  if (!user.twoFactorEnabled) {
    return { success: false, message: "Two-factor authentication is not enabled." };
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return { success: false, message: "Incorrect password." };
  }

  const backupCodes = generateBackupCodes(10);
  const hashedCodes = await hashBackupCodes(backupCodes);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorBackupCodes: hashedCodes },
  });

  return {
    success: true,
    message: "Backup codes regenerated.",
    backupCodes,
  };
}
