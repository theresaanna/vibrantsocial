/**
 * Mobile OAuth flow using expo-web-browser.
 *
 * Opens the server's OAuth bridge in an in-app browser, which:
 * 1. If already logged in on web → immediately returns a JWT
 * 2. Otherwise redirects to Google/Discord OAuth
 * 3. On success, redirects to vibrantsocial://auth-callback?token=JWT
 * 4. expo-web-browser intercepts the deep link and returns the URL
 */
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://vibrantsocial.app";

export type OAuthProvider = "google" | "discord";

export interface OAuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * Start the OAuth flow for the given provider.
 * Returns the JWT token on success.
 */
export async function startOAuthFlow(provider: OAuthProvider): Promise<OAuthResult> {
  try {
    const oauthUrl = `${API_BASE_URL}/api/auth/mobile/oauth?provider=${provider}`;

    if (Platform.OS === "web") {
      return await startOAuthFlowWeb(oauthUrl, provider);
    }

    // Native: open in-app browser
    const redirectUrl = Linking.createURL("auth-callback");
    const result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectUrl);

    if (result.type === "success" && result.url) {
      return parseAuthCallbackUrl(result.url);
    }

    if (result.type === "cancel" || result.type === "dismiss") {
      return { success: false, error: "Login cancelled" };
    }

    return { success: false, error: "OAuth flow failed" };
  } catch (error) {
    console.error("[oauth]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "OAuth failed",
    };
  }
}

/**
 * Parse the auth callback URL to extract the token or error.
 */
function parseAuthCallbackUrl(url: string): OAuthResult {
  try {
    const parsed = Linking.parse(url);
    const token = parsed.queryParams?.token as string | undefined;
    const error = parsed.queryParams?.error as string | undefined;

    if (token) {
      return { success: true, token };
    }

    return { success: false, error: error || "No token received" };
  } catch {
    return { success: false, error: "Failed to parse callback URL" };
  }
}

/**
 * Web OAuth flow:
 * 1. First, try a direct JSON fetch to the OAuth endpoint (with credentials).
 *    If the user is already logged in on the web app, this returns a JWT
 *    immediately without needing a popup.
 * 2. If no session exists, open a popup for the full OAuth flow and listen
 *    for the token via postMessage.
 */
async function startOAuthFlowWeb(oauthUrl: string, provider: OAuthProvider): Promise<OAuthResult> {
  // Step 1: Try direct fetch — works if user is already logged in on web
  console.log("[oauth-web] Trying direct JSON fetch...");
  try {
    const jsonUrl = `${oauthUrl}&format=json`;
    const res = await fetch(jsonUrl, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        console.log("[oauth-web] Got token via direct fetch");
        return { success: true, token: data.token };
      }
    }
    // 401 = no session, fall through to popup flow
    console.log("[oauth-web] No session, falling back to popup flow");
  } catch (e) {
    console.log("[oauth-web] Direct fetch failed (CORS?), trying popup...", e);
  }

  // Step 2: Open popup for full OAuth flow
  return new Promise((resolve) => {
    const popupUrl = `${oauthUrl}&caller_origin=${encodeURIComponent(window.location.origin)}`;
    console.log("[oauth-web] Opening popup:", popupUrl);
    const popup = window.open(popupUrl, "oauth", "width=500,height=700,popup=yes");

    if (!popup) {
      console.error("[oauth-web] Popup was blocked by browser");
      resolve({ success: false, error: "Popup blocked. Please allow popups." });
      return;
    }
    console.log("[oauth-web] Popup opened successfully");

    let resolved = false;
    const cleanup = () => {
      resolved = true;
      clearInterval(pollInterval);
      window.removeEventListener("message", messageHandler);
    };

    const handleSuccess = (token: string) => {
      if (resolved) return;
      console.log("[oauth-web] Got token, length:", token.length);
      cleanup();
      try { popup.close(); } catch {}
      resolve({ success: true, token });
    };

    // Listen for postMessage from the completion page
    const expectedOrigin = new URL(API_BASE_URL).origin;
    const messageHandler = (event: MessageEvent) => {
      console.log("[oauth-web] Received message:", event.data?.type, event.origin);
      // Only accept messages from our own server origin
      if (event.origin !== expectedOrigin) return;
      if (event.data?.type === "vibrantsocial-oauth") {
        if (event.data.token) {
          handleSuccess(event.data.token);
        } else {
          if (resolved) return;
          cleanup();
          try { popup.close(); } catch {}
          resolve({ success: false, error: event.data.error || "OAuth failed" });
        }
      }
    };
    window.addEventListener("message", messageHandler);

    // Poll for popup closing — when it closes, try the JSON fetch again
    // (user may have completed OAuth in the popup, creating a web session)
    const pollInterval = setInterval(() => {
      if (resolved) return;
      try {
        if (popup.closed) {
          console.log("[oauth-web] Popup closed, trying to fetch token...");
          clearInterval(pollInterval);

          // The popup may have created a web session via OAuth.
          // Try fetching the token now.
          const jsonUrl = `${API_BASE_URL}/api/auth/mobile/oauth?provider=${provider}&format=json`;
          fetch(jsonUrl, {
            credentials: "include",
            headers: { Accept: "application/json" },
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.token) {
                handleSuccess(data.token);
              } else {
                if (resolved) return;
                cleanup();
                resolve({ success: false, error: "Login cancelled" });
              }
            })
            .catch(() => {
              if (resolved) return;
              cleanup();
              resolve({ success: false, error: "Login cancelled" });
            });
        }
      } catch {
        // Cross-origin, keep polling
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      if (resolved) return;
      cleanup();
      try { popup.close(); } catch {}
      resolve({ success: false, error: "Login timed out" });
    }, 5 * 60 * 1000);
  });
}
