"use server";

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { authLimiter, isRateLimited } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { decryptSecret, verifyTOTPCode, verifyBackupCode } from "@/lib/two-factor";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/types";

// --------------------------------------------------------------------------
// Pending 2FA token store — maps token to { userId, email, expires }
// In production, use Redis. This Map is per-process and works for single-server deploys.
// --------------------------------------------------------------------------

interface PendingTwoFactor {
  userId: string;
  email: string;
  expires: number;
}

const pendingStore = new Map<string, PendingTwoFactor>();

/** Create a pending 2FA challenge token. Expires in 5 minutes. */
export function createPendingTwoFactorToken(
  userId: string,
  email: string
): string {
  // Clean expired tokens periodically
  for (const [key, val] of pendingStore) {
    if (val.expires < Date.now()) pendingStore.delete(key);
  }

  const token = crypto.randomUUID();
  pendingStore.set(token, {
    userId,
    email,
    expires: Date.now() + 5 * 60 * 1000,
  });
  return token;
}

/** Consume a pending token — returns the stored data or null if expired/invalid. */
function consumePendingToken(token: string): PendingTwoFactor | null {
  const entry = pendingStore.get(token);
  if (!entry || entry.expires < Date.now()) {
    pendingStore.delete(token);
    return null;
  }
  // Don't delete yet — user might retry TOTP code entry
  return entry;
}

/** Fully consume (delete) a pending token after successful verification. */
function deletePendingToken(token: string) {
  pendingStore.delete(token);
}

// --------------------------------------------------------------------------
// Verify TOTP code during login
// --------------------------------------------------------------------------

interface TwoFactorVerifyState {
  success: boolean;
  message: string;
}

export async function verifyTwoFactorLogin(
  pendingToken: string,
  code: string
): Promise<TwoFactorVerifyState> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (await isRateLimited(authLimiter, `2fa-login:${ip}`)) {
    return { success: false, message: "Too many attempts. Please try again later." };
  }

  if (!pendingToken) {
    return { success: false, message: "Session expired. Please log in again." };
  }

  const pending = consumePendingToken(pendingToken);
  if (!pending) {
    return { success: false, message: "Session expired. Please log in again." };
  }

  if (!code || !/^\d{6}$/.test(code)) {
    return { success: false, message: "Please enter a valid 6-digit code." };
  }

  const user = await prisma.user.findUnique({
    where: { id: pending.userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return { success: false, message: "2FA is not configured for this account." };
  }

  const secret = decryptSecret(user.twoFactorSecret);
  if (!verifyTOTPCode(secret, code)) {
    return { success: false, message: "Invalid code. Please try again." };
  }

  // Success — complete the sign-in
  deletePendingToken(pendingToken);

  try {
    await signIn("credentials", {
      email: pending.email,
      password: "__2fa_verified__",
      redirectTo: "/complete-profile",
      __twoFactorBypass: "true",
    });
    return { success: true, message: "" };
  } catch (error: unknown) {
    // Re-throw NEXT_REDIRECT
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { success: false, message: "Login failed. Please try again." };
  }
}

// --------------------------------------------------------------------------
// Verify backup code during login
// --------------------------------------------------------------------------

export async function verifyBackupCodeLogin(
  pendingToken: string,
  code: string
): Promise<TwoFactorVerifyState> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (await isRateLimited(authLimiter, `2fa-login:${ip}`)) {
    return { success: false, message: "Too many attempts. Please try again later." };
  }

  if (!pendingToken) {
    return { success: false, message: "Session expired. Please log in again." };
  }

  const pending = consumePendingToken(pendingToken);
  if (!pending) {
    return { success: false, message: "Session expired. Please log in again." };
  }

  if (!code?.trim()) {
    return { success: false, message: "Please enter a backup code." };
  }

  const user = await prisma.user.findUnique({
    where: { id: pending.userId },
    select: { twoFactorEnabled: true, twoFactorBackupCodes: true },
  });

  if (!user?.twoFactorEnabled) {
    return { success: false, message: "2FA is not configured for this account." };
  }

  const matchIndex = await verifyBackupCode(code.trim(), user.twoFactorBackupCodes);
  if (matchIndex === -1) {
    return { success: false, message: "Invalid backup code." };
  }

  // Remove the used backup code
  const updatedCodes = [...user.twoFactorBackupCodes];
  updatedCodes.splice(matchIndex, 1);
  await prisma.user.update({
    where: { id: pending.userId },
    data: { twoFactorBackupCodes: updatedCodes },
  });

  // Complete sign-in
  deletePendingToken(pendingToken);

  try {
    await signIn("credentials", {
      email: pending.email,
      password: "__2fa_verified__",
      redirectTo: "/complete-profile",
      __twoFactorBypass: "true",
    });
    return { success: true, message: "" };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { success: false, message: "Login failed. Please try again." };
  }
}

// --------------------------------------------------------------------------
// WebAuthn authentication options (for login)
// --------------------------------------------------------------------------

const webauthnChallengeStore = new Map<string, { challenge: string; expires: number }>();

export async function getPasskeyAuthenticationOptions(
  pendingToken: string
): Promise<{ success: boolean; message: string; options?: PublicKeyCredentialRequestOptionsJSON }> {
  if (!pendingToken) {
    return { success: false, message: "Session expired." };
  }

  const pending = consumePendingToken(pendingToken);
  if (!pending) {
    return { success: false, message: "Session expired." };
  }

  const credentials = await prisma.webAuthnCredential.findMany({
    where: { userId: pending.userId },
    select: { credentialId: true, transports: true },
  });

  if (credentials.length === 0) {
    return { success: false, message: "No passkeys registered." };
  }

  const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((c: { credentialId: string; transports: string[] }) => ({
      id: c.credentialId,
      transports: c.transports as AuthenticatorTransport[],
    })),
    userVerification: "preferred",
  });

  webauthnChallengeStore.set(pending.userId, {
    challenge: options.challenge,
    expires: Date.now() + 5 * 60 * 1000,
  });

  return { success: true, message: "", options };
}

type AuthenticatorTransport = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

// --------------------------------------------------------------------------
// Verify passkey authentication during login
// --------------------------------------------------------------------------

export async function verifyPasskeyLogin(
  pendingToken: string,
  response: AuthenticationResponseJSON
): Promise<TwoFactorVerifyState> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (await isRateLimited(authLimiter, `2fa-login:${ip}`)) {
    return { success: false, message: "Too many attempts. Please try again later." };
  }

  if (!pendingToken) {
    return { success: false, message: "Session expired. Please log in again." };
  }

  const pending = consumePendingToken(pendingToken);
  if (!pending) {
    return { success: false, message: "Session expired. Please log in again." };
  }

  const challengeEntry = webauthnChallengeStore.get(pending.userId);
  webauthnChallengeStore.delete(pending.userId);
  if (!challengeEntry || challengeEntry.expires < Date.now()) {
    return { success: false, message: "Challenge expired. Please try again." };
  }

  const credential = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: response.id },
    select: { id: true, userId: true, credentialId: true, publicKey: true, counter: true, transports: true },
  });

  if (!credential || credential.userId !== pending.userId) {
    return { success: false, message: "Passkey not recognized." };
  }

  const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";
  const origin = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeEntry.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(credential.publicKey),
        counter: Number(credential.counter),
        transports: credential.transports as AuthenticatorTransport[],
      },
    });

    if (!verification.verified) {
      return { success: false, message: "Passkey verification failed." };
    }

    // Update counter and last used timestamp
    await prisma.webAuthnCredential.update({
      where: { id: credential.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });
  } catch {
    return { success: false, message: "Passkey verification failed." };
  }

  // Complete sign-in
  deletePendingToken(pendingToken);

  try {
    await signIn("credentials", {
      email: pending.email,
      password: "__2fa_verified__",
      redirectTo: "/complete-profile",
      __twoFactorBypass: "true",
    });
    return { success: true, message: "" };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { success: false, message: "Login failed. Please try again." };
  }
}

// --------------------------------------------------------------------------
// Check if user has passkeys (for UI display)
// --------------------------------------------------------------------------

export async function hasPasskeysForPending(
  pendingToken: string
): Promise<boolean> {
  if (!pendingToken) return false;
  const pending = consumePendingToken(pendingToken);
  if (!pending) return false;
  const count = await prisma.webAuthnCredential.count({
    where: { userId: pending.userId },
  });
  return count > 0;
}
