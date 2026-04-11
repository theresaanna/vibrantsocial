import { Platform } from "react-native";

/**
 * Platform-aware secure storage.
 *
 * - Native (iOS/Android): uses expo-secure-store (Keychain / EncryptedSharedPreferences)
 * - Web (dev only): uses an in-memory map so tokens are never written to
 *   localStorage/sessionStorage. Tokens don't survive page reload on web,
 *   which is fine since Expo web is only used during development.
 */

let SecureStoreModule: typeof import("expo-secure-store") | null = null;

if (Platform.OS !== "web") {
  SecureStoreModule = require("expo-secure-store");
}

// In-memory store for web — avoids clear-text storage of sensitive data
const webMemoryStore = new Map<string, string>();

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return webMemoryStore.get(key) ?? null;
  }
  return SecureStoreModule!.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    webMemoryStore.set(key, value);
    return;
  }
  await SecureStoreModule!.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    webMemoryStore.delete(key);
    return;
  }
  await SecureStoreModule!.deleteItemAsync(key);
}
