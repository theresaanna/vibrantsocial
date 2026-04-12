import { VibrantApiClient } from "@vibrantsocial/shared/api-client";
import * as SecureStorage from "./secure-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://www.vibrantsocial.app";

export const TOKEN_KEY = "auth_token";

export const api = new VibrantApiClient({
  baseUrl: API_BASE_URL,
  getAuthHeaders: async () => {
    const token = await SecureStorage.getItem(TOKEN_KEY);
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  },
});

/**
 * Store the auth JWT after login/signup.
 */
export async function setAuthToken(token: string): Promise<void> {
  await SecureStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove the auth JWT on logout.
 */
export async function clearAuthToken(): Promise<void> {
  await SecureStorage.deleteItem(TOKEN_KEY);
}

/**
 * Check if a token exists (for initial auth check).
 */
export async function hasAuthToken(): Promise<boolean> {
  const token = await SecureStorage.getItem(TOKEN_KEY);
  return !!token;
}
