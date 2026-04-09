import crypto from "crypto";
import { TOTP } from "otpauth";
import bcrypt from "bcryptjs";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  if (!key) throw new Error("TWO_FACTOR_ENCRYPTION_KEY is not set");
  // Key should be a 64-char hex string (32 bytes)
  return Buffer.from(key, "hex");
}

/** Encrypt a TOTP secret for storage. Returns base64 string: iv:ciphertext:tag */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

/** Decrypt a stored TOTP secret. */
export function decryptSecret(stored: string): string {
  const key = getEncryptionKey();
  const [ivB64, encB64, tagB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const encrypted = Buffer.from(encB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

/** Generate a new random TOTP secret (base32). */
export function generateTOTPSecret(): string {
  const totp = new TOTP({ issuer: "VibrantSocial", algorithm: "SHA1", digits: 6, period: 30 });
  return totp.secret.base32;
}

/** Build a TOTP URI for QR code display. */
export function getTOTPUri(secret: string, email: string): string {
  const totp = new TOTP({
    issuer: "VibrantSocial",
    label: email,
    secret,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return totp.toString();
}

/**
 * Verify a TOTP code against a secret.
 * Allows a 1-period window in each direction to account for clock skew.
 */
export function verifyTOTPCode(secret: string, code: string): boolean {
  const totp = new TOTP({
    issuer: "VibrantSocial",
    secret,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  // validate() returns the time step difference or null if invalid
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

/** Generate a set of backup recovery codes. */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // 8-character alphanumeric codes, grouped as xxxx-xxxx for readability
    const raw = crypto.randomBytes(5).toString("hex").slice(0, 8);
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

/** Hash backup codes for storage. Uses bcrypt with lower rounds for batch hashing. */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code.replace("-", ""), 8)));
}

/** Verify a backup code against the stored hashes. Returns the index if found, -1 otherwise. */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<number> {
  const normalized = code.replace("-", "").toLowerCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(normalized, hashedCodes[i])) {
      return i;
    }
  }
  return -1;
}
