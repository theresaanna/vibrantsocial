"use client";

import { useEffect, useState } from "react";
import {
  detectInAppBrowser,
  buildIntentUrl,
  type InAppBrowserInfo,
} from "@/lib/in-app-browser";

interface InAppBrowserBreakoutProps {
  /** When true, hides children (links) inside in-app browsers */
  sensitiveLinks: boolean;
  children: React.ReactNode;
}

/**
 * Wraps the links section and handles in-app browser breakout:
 *
 * - **Android**: auto-redirects to the default browser via `intent://`
 * - **iOS**: shows a full-screen overlay prompting the user to open in Safari
 * - **Sensitive mode**: hides all links when inside an in-app browser
 * - **Normal browsers**: renders children directly
 *
 * Children start hidden until detection completes to prevent a flash of
 * sensitive content in in-app browsers.
 */
export function InAppBrowserBreakout({
  sensitiveLinks,
  children,
}: InAppBrowserBreakoutProps) {
  const [browserInfo, setBrowserInfo] = useState<InAppBrowserInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const info = detectInAppBrowser(navigator.userAgent);
    setBrowserInfo(info);

    // Android: immediately redirect to default browser
    if (info.isInAppBrowser && info.platform === "android") {
      window.location.replace(buildIntentUrl(window.location.href));
    }
  }, []);

  // Haven't detected yet — if sensitive, hide links to prevent flash
  if (browserInfo === null) {
    return sensitiveLinks ? null : <>{children}</>;
  }

  // Normal browser — render everything
  if (!browserInfo.isInAppBrowser) {
    return <>{children}</>;
  }

  // Android — being redirected, show brief message
  if (browserInfo.platform === "android") {
    return (
      <div
        className="flex flex-col items-center gap-3 py-8 text-center"
        data-testid="android-redirect"
      >
        <p className="text-sm profile-text-secondary">
          Opening in your browser…
        </p>
      </div>
    );
  }

  // iOS in-app browser
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable in some webviews
    }
  };

  const openInstructions = getOpenInstructions(browserInfo.app);

  return (
    <div className="space-y-4" data-testid="ios-breakout">
      {/* Overlay prompt */}
      <div className="flex flex-col items-center gap-4 rounded-xl profile-container px-5 py-6 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8 profile-text-secondary"
          aria-hidden="true"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>

        <div className="space-y-1">
          <p className="text-sm font-medium profile-text">
            Open in Safari for the best experience
          </p>
          <p className="text-xs profile-text-secondary">{openInstructions}</p>
        </div>

        <button
          onClick={handleCopyLink}
          className="links-page-btn rounded-lg profile-container px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          data-testid="copy-link-btn"
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>

      {/* Show links only if NOT sensitive mode */}
      {sensitiveLinks ? (
        <p
          className="text-center text-xs profile-text-secondary"
          data-testid="sensitive-hidden-msg"
        >
          This creator&apos;s links are hidden in app browsers. Open in Safari
          to view them.
        </p>
      ) : (
        children
      )}
    </div>
  );
}

/**
 * Return app-specific instructions for opening in Safari.
 */
function getOpenInstructions(app: string): string {
  switch (app) {
    case "Instagram":
      return "Tap ··· in the top right, then \"Open in Safari\".";
    case "TikTok":
      return "Tap ··· in the top right, then \"Open in browser\".";
    case "Facebook":
      return "Tap ⋯ in the bottom right, then \"Open in Safari\".";
    case "Twitter":
      return "Tap the share icon, then \"Open in Safari\".";
    case "Snapchat":
      return "Tap ··· then \"Open in Safari\".";
    default:
      return "Look for \"Open in browser\" in the menu.";
  }
}
