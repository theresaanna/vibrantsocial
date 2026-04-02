"use client";

import { useEffect, useState } from "react";
import {
  detectInAppBrowser,
  buildIntentUrl,
  type InAppBrowserInfo,
} from "@/lib/in-app-browser";

export interface LinkData {
  id: string;
  title: string;
  url: string;
}

interface InAppBrowserBreakoutProps {
  /**
   * When true, links never enter the DOM until the client confirms
   * a normal browser. Link data is passed via `linkData` instead
   * of children so nothing leaks into the SSR HTML.
   */
  sensitiveLinks: boolean;
  /** Link data — only used when sensitiveLinks is true. */
  linkData?: LinkData[];
  /** Pre-rendered links — only used when sensitiveLinks is false. */
  children?: React.ReactNode;
}

/**
 * Handles in-app browser breakout for the links page:
 *
 * - **Android**: auto-redirects to the default browser via `intent://`
 * - **iOS**: shows a full-screen overlay prompting the user to open in Safari
 * - **Sensitive mode** (`sensitiveLinks=true`): link data is kept out of
 *   the server-rendered HTML entirely. Links are only rendered client-side
 *   after detection confirms a normal browser.
 * - **Normal mode** (`sensitiveLinks=false`): children are server-rendered
 *   as usual and shown immediately.
 */
export function InAppBrowserBreakout({
  sensitiveLinks,
  linkData,
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

  // --- Sensitive mode: links never in SSR, rendered client-side only ---
  if (sensitiveLinks) {
    // Before detection: render nothing (no links in DOM)
    if (browserInfo === null) return null;

    // In-app browser detected: show breakout UI, never render links
    if (browserInfo.isInAppBrowser) {
      if (browserInfo.platform === "android") {
        return <RedirectMessage />;
      }
      return (
        <IosBreakout
          app={browserInfo.app}
          copied={copied}
          onCopy={() => handleCopyLink(setCopied)}
        >
          <p
            className="text-center text-xs profile-text-secondary"
            data-testid="sensitive-hidden-msg"
          >
            This creator&apos;s links are hidden in app browsers. Open in
            Safari to view them.
          </p>
        </IosBreakout>
      );
    }

    // Normal browser confirmed — safe to render links client-side
    return <LinkList links={linkData ?? []} />;
  }

  // --- Normal mode: children are server-rendered ---

  // Before detection: show children (they're not sensitive)
  if (browserInfo === null) return <>{children}</>;

  // Normal browser: show children
  if (!browserInfo.isInAppBrowser) return <>{children}</>;

  // Android in-app: redirect in progress
  if (browserInfo.platform === "android") return <RedirectMessage />;

  // iOS in-app: show breakout overlay + children (not sensitive, OK to show)
  return (
    <IosBreakout
      app={browserInfo.app}
      copied={copied}
      onCopy={() => handleCopyLink(setCopied)}
    >
      {children}
    </IosBreakout>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function RedirectMessage() {
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

function IosBreakout({
  app,
  copied,
  onCopy,
  children,
}: {
  app: string;
  copied: boolean;
  onCopy: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4" data-testid="ios-breakout">
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
          <p className="text-xs profile-text-secondary">
            {getOpenInstructions(app)}
          </p>
        </div>

        <button
          onClick={onCopy}
          className="links-page-btn rounded-lg profile-container px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          data-testid="copy-link-btn"
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>

      {children}
    </div>
  );
}

/** Render links client-side (used only in sensitive mode after safe-browser check). */
function LinkList({ links }: { links: LinkData[] }) {
  if (links.length === 0) return null;
  return (
    <div className="space-y-3" data-testid="client-rendered-links">
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="links-page-btn block w-full rounded-xl profile-container px-4 py-3 text-center font-medium transition-opacity hover:opacity-80"
          data-testid="links-page-link"
        >
          {link.title}
        </a>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function handleCopyLink(setCopied: (v: boolean) => void) {
  navigator.clipboard.writeText(window.location.href).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }).catch(() => {
    // Clipboard API may be unavailable in some webviews
  });
}

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
