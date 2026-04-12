import { Platform } from "react-native";

/**
 * Platform-aware secure storage.
 *
 * - Native (iOS/Android): uses expo-secure-store (Keychain / EncryptedSharedPreferences)
 * - Web: encrypts values with AES-GCM via the Web Crypto API before storing
 *   them in sessionStorage. The encryption key is held only in memory, so data
 *   cannot be read from storage by other scripts without the key, and the
 *   session is cleared automatically when the tab closes.
 */

let SecureStoreModule: typeof import("expo-secure-store") | null = null;

if (Platform.OS !== "web") {
  SecureStoreModule = require("expo-secure-store");
}

// ── Web Crypto helpers (AES-GCM) ────────────────────────────────────

/** Per-session encryption key, generated lazily and held only in memory. */
let _webKey: CryptoKey | null = null;

async function getWebKey(): Promise<CryptoKey> {
  if (!_webKey) {
    _webKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,          // not extractable
      ["encrypt", "decrypt"],
    );
  }
  return _webKey;
}

async function encryptValue(plaintext: string): Promise<string> {
  const key = await getWebKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  // Store as base64: iv (12 bytes) + ciphertext
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptValue(stored: string): Promise<string> {
  const key = await getWebKey();
  const raw = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const ciphertext = raw.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

// ── Public API ──────────────────────────────────────────────────────

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      const stored = sessionStorage.getItem(key);
      if (!stored) return null;
      return await decryptValue(stored);
    } catch {
      return null;
    }
  }
  return SecureStoreModule!.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      const encrypted = await encryptValue(value);
      sessionStorage.setItem(key, encrypted);
    } catch { /* noop */ }
    return;
  }
  await SecureStoreModule!.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try { sessionStorage.removeItem(key); } catch { /* noop */ }
    return;
  }
  await SecureStoreModule!.deleteItemAsync(key);
}
