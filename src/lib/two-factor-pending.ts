// Pending 2FA token store — maps token to { userId, email, expires }
// In production, use Redis. This Map is per-process and works for single-server deploys.

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
export function consumePendingToken(token: string): PendingTwoFactor | null {
  const entry = pendingStore.get(token);
  if (!entry || entry.expires < Date.now()) {
    pendingStore.delete(token);
    return null;
  }
  // Don't delete yet — user might retry TOTP code entry
  return entry;
}

/** Fully consume (delete) a pending token after successful verification. */
export function deletePendingToken(token: string) {
  pendingStore.delete(token);
}
