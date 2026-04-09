"use server";

import { prisma } from "@/lib/prisma";
import { requireAuthWithRateLimit, isActionError } from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/types";
import { revalidatePath } from "next/cache";

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

const RP_NAME = "VibrantSocial";

function getRPID(): string {
  return process.env.WEBAUTHN_RP_ID ?? "localhost";
}

function getOrigin(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

// In-memory challenge store with 5-minute expiry (keyed by userId)
// In production this should use Redis, but for simplicity we use a Map
const challengeStore = new Map<string, { challenge: string; expires: number }>();

function storeChallenge(userId: string, challenge: string) {
  challengeStore.set(userId, {
    challenge,
    expires: Date.now() + 5 * 60 * 1000,
  });
}

function getAndClearChallenge(userId: string): string | null {
  const entry = challengeStore.get(userId);
  challengeStore.delete(userId);
  if (!entry || entry.expires < Date.now()) return null;
  return entry.challenge;
}

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface PasskeyRegistrationOptions extends ActionState {
  options?: PublicKeyCredentialCreationOptionsJSON;
}

export interface PasskeyInfo {
  id: string;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  deviceType: string;
  backedUp: boolean;
}

// --------------------------------------------------------------------------
// Generate registration options
// --------------------------------------------------------------------------

export async function generatePasskeyRegistrationOptions(): Promise<PasskeyRegistrationOptions> {
  const result = await requireAuthWithRateLimit("2fa");
  if (isActionError(result)) return result;
  const session = result;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      username: true,
      displayName: true,
      twoFactorEnabled: true,
      webauthnCredentials: {
        select: { credentialId: true },
      },
    },
  });

  if (!user?.twoFactorEnabled) {
    return {
      success: false,
      message: "Enable two-factor authentication (TOTP) before adding passkeys.",
    };
  }

  const existingCredentials = user.webauthnCredentials.map((cred: { credentialId: string }) => ({
    id: cred.credentialId,
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: getRPID(),
    userName: user.email ?? user.username ?? session.user.id,
    userDisplayName: user.displayName ?? user.username ?? "User",
    attestationType: "none",
    excludeCredentials: existingCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  storeChallenge(session.user.id, options.challenge);

  return { success: true, message: "", options };
}

// --------------------------------------------------------------------------
// Verify registration and store credential
// --------------------------------------------------------------------------

export async function verifyPasskeyRegistration(
  response: RegistrationResponseJSON,
  name?: string
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("2fa");
  if (isActionError(result)) return result;
  const session = result;

  const expectedChallenge = getAndClearChallenge(session.user.id);
  if (!expectedChallenge) {
    return { success: false, message: "Registration challenge expired. Please try again." };
  }

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRPID(),
    });
  } catch {
    return { success: false, message: "Passkey verification failed." };
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { success: false, message: "Passkey verification failed." };
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  await prisma.webAuthnCredential.create({
    data: {
      userId: session.user.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: response.response.transports ?? [],
      name: name || null,
    },
  });

  revalidatePath("/profile");

  return { success: true, message: "Passkey registered successfully!" };
}

// --------------------------------------------------------------------------
// List passkeys
// --------------------------------------------------------------------------

export async function listPasskeys(): Promise<PasskeyInfo[]> {
  const result = await requireAuthWithRateLimit("2fa");
  if (isActionError(result)) return [];
  const session = result;

  const credentials = await prisma.webAuthnCredential.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      createdAt: true,
      lastUsedAt: true,
      deviceType: true,
      backedUp: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return credentials.map((c: { id: string; name: string | null; createdAt: Date; lastUsedAt: Date | null; deviceType: string; backedUp: boolean }) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt.toISOString(),
    lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
    deviceType: c.deviceType,
    backedUp: c.backedUp,
  }));
}

// --------------------------------------------------------------------------
// Remove a passkey
// --------------------------------------------------------------------------

export async function removePasskey(credentialDbId: string): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("2fa");
  if (isActionError(result)) return result;
  const session = result;

  if (!credentialDbId) {
    return { success: false, message: "Credential ID is required." };
  }

  const credential = await prisma.webAuthnCredential.findUnique({
    where: { id: credentialDbId },
    select: { userId: true },
  });

  if (!credential || credential.userId !== session.user.id) {
    return { success: false, message: "Passkey not found." };
  }

  await prisma.webAuthnCredential.delete({
    where: { id: credentialDbId },
  });

  revalidatePath("/profile");

  return { success: true, message: "Passkey removed." };
}

// --------------------------------------------------------------------------
// Rename a passkey
// --------------------------------------------------------------------------

export async function renamePasskey(
  credentialDbId: string,
  newName: string
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("2fa");
  if (isActionError(result)) return result;
  const session = result;

  if (!credentialDbId || !newName?.trim()) {
    return { success: false, message: "Name is required." };
  }

  const credential = await prisma.webAuthnCredential.findUnique({
    where: { id: credentialDbId },
    select: { userId: true },
  });

  if (!credential || credential.userId !== session.user.id) {
    return { success: false, message: "Passkey not found." };
  }

  await prisma.webAuthnCredential.update({
    where: { id: credentialDbId },
    data: { name: newName.trim().slice(0, 100) },
  });

  return { success: true, message: "Passkey renamed." };
}
