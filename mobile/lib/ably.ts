import * as Ably from "ably";
import * as SecureStorage from "./secure-storage";
import { TOKEN_KEY } from "./api";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://www.vibrantsocial.app";

export const ablyClient = new Ably.Realtime({
  authCallback: async (_data, callback) => {
    try {
      const token = await SecureStorage.getItem(TOKEN_KEY);
      if (!token) {
        callback(new Error("Not authenticated"), null);
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/ably-token`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        callback(new Error(`Ably token request failed: ${res.status}`), null);
        return;
      }
      const tokenRequest = await res.json();
      callback(null, tokenRequest);
    } catch (err) {
      callback(err instanceof Error ? err : new Error("Ably auth failed"), null);
    }
  },
  autoConnect: false,
});
