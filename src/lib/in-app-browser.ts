/**
 * Utilities for detecting in-app browsers and building breakout URLs.
 *
 * In-app browsers (Instagram, TikTok, Facebook, etc.) embed a WebView
 * that restricts normal browser features. These utilities help detect
 * them and redirect users to their default browser.
 */

/** Known in-app browser signatures mapped to display name. */
const IN_APP_SIGNATURES: Array<{ pattern: RegExp; app: string }> = [
  { pattern: /\bInstagram\b/i, app: "Instagram" },
  { pattern: /\b(BytedanceWebview|TikTok)\b/i, app: "TikTok" },
  { pattern: /\b(FBAN|FBAV)\b/, app: "Facebook" },
  { pattern: /\bTwitter\b/i, app: "Twitter" },
  { pattern: /\bSnapchat\b/i, app: "Snapchat" },
  { pattern: /\bLinkedInApp\b/i, app: "LinkedIn" },
  { pattern: /\bLine\//i, app: "Line" },
  { pattern: /\bPinterest\b/i, app: "Pinterest" },
];

export type InAppBrowserInfo =
  | { isInAppBrowser: false }
  | { isInAppBrowser: true; platform: "android" | "ios"; app: string };

/**
 * Detect whether the given user-agent string belongs to an in-app browser
 * and, if so, which platform and app it's running in.
 */
export function detectInAppBrowser(userAgent: string): InAppBrowserInfo {
  for (const { pattern, app } of IN_APP_SIGNATURES) {
    if (pattern.test(userAgent)) {
      const platform = /android/i.test(userAgent) ? "android" : "ios";
      return { isInAppBrowser: true, platform, app };
    }
  }
  return { isInAppBrowser: false };
}

/**
 * Build an Android `intent://` URL that opens the given page URL in the
 * user's default browser.
 *
 * @see https://developer.chrome.com/docs/android/intents
 */
export function buildIntentUrl(pageUrl: string): string {
  // Strip the scheme — intent:// replaces it
  const withoutScheme = pageUrl.replace(/^https?:\/\//, "");
  return `intent://${withoutScheme}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
}
