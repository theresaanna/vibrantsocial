import { Platform } from "react-native";

/**
 * Platform-aware secure storage.
 *
 * - Native (iOS/Android): uses expo-secure-store (Keychain / EncryptedSharedPreferences)
 * - Web: encrypts values with AES-GCM (Web Crypto API) before storing in
 *   localStorage. The encryption key is derived from the origin via PBKDF2
 *   so it is stable across page reloads while still preventing raw token
 *   access from storage inspection.
 */

let SecureStoreModule: typeof import("expo-secure-store") | null = null;

if (Platform.OS !== "web") {
  SecureStoreModule = require("expo-secure-store");
}

// ── Web Crypto helpers ──────────────────────────────────────────────

let _webKey: CryptoKey | null = null;

async function getWebKey(): Promise<CryptoKey> {
  if (_webKey) return _webKey;

  // Derive a stable key from the origin so it survives page reloads
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(location.origin + ":vibrantsocial-mobile-storage"),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  _webKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("vibrantsocial-secure-storage-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return _webKey;
}

async function encryptForStorage(plaintext: string): Promise<string> {
  const key = await getWebKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptFromStorage(stored: string): Promise<string> {
  const key = await getWebKey();
  const raw = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const ciphertext = raw.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// ── Public API ──────────────────────────────────────────────────────

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      return await decryptFromStorage(stored);
    } catch {
      // If decryption fails (e.g. stored before encryption was added),
      // clear the corrupt entry so a fresh login can store a new token.
      try { localStorage.removeItem(key); } catch { /* noop */ }
      return null;
    }
  }
  return SecureStoreModule!.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      const encrypted = await encryptForStorage(value);
      localStorage.setItem(key, encrypted);
    } catch { /* storage full or unavailable */ }
    return;
  }
  await SecureStoreModule!.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try { localStorage.removeItem(key); } catch { /* noop */ }
    return;
  }
  await SecureStoreModule!.deleteItemAsync(key);
}
