import { Platform } from "react-native";

/**
 * Platform-aware secure storage.
 *
 * - Native (iOS/Android): uses expo-secure-store (Keychain / EncryptedSharedPreferences)
 * - Web: uses localStorage so tokens persist across page reloads.
 */

let SecureStoreModule: typeof import("expo-secure-store") | null = null;

if (Platform.OS !== "web") {
  SecureStoreModule = require("expo-secure-store");
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  return SecureStoreModule!.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try { localStorage.setItem(key, value); } catch {}
    return;
  }
  await SecureStoreModule!.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try { localStorage.removeItem(key); } catch {}
    return;
  }
  await SecureStoreModule!.deleteItemAsync(key);
}
