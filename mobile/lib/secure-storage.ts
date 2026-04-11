import { Platform } from "react-native";

/**
 * Platform-aware secure storage.
 * Uses expo-secure-store on native, localStorage on web.
 */

let SecureStoreModule: typeof import("expo-secure-store") | null = null;

if (Platform.OS !== "web") {
  SecureStoreModule = require("expo-secure-store");
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStoreModule!.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStoreModule!.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  await SecureStoreModule!.deleteItemAsync(key);
}
