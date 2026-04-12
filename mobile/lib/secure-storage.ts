import { Platform } from "react-native";

/**
 * Platform-aware secure storage.
 *
 * - Native (iOS/Android): uses expo-secure-store (Keychain / EncryptedSharedPreferences)
 * - Web: uses sessionStorage so tokens are scoped to the browser tab/session
 *   and are cleared when the tab is closed, reducing the exposure window for
 *   sensitive data.  This is a best-effort fallback — the Web Crypto API does
 *   not offer a persistent, encrypted key-value store.
 */

let SecureStoreModule: typeof import("expo-secure-store") | null = null;

if (Platform.OS !== "web") {
  SecureStoreModule = require("expo-secure-store");
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return sessionStorage.getItem(key); } catch { return null; }
  }
  return SecureStoreModule!.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try { sessionStorage.setItem(key, value); } catch { /* noop */ }
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
