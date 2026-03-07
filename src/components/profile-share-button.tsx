"use client";

import { useState } from "react";

interface ProfileShareButtonProps {
  username: string;
  hasCustomTheme?: boolean;
}

export function ProfileShareButton({ username, hasCustomTheme }: ProfileShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/${username}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `@${username}`, url });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  }

  return (
    <button
      onClick={handleShare}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        hasCustomTheme
          ? "profile-share-btn"
          : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
      style={
        hasCustomTheme
          ? ({
              borderColor: "var(--profile-secondary)",
              color: "var(--profile-text)",
            } as React.CSSProperties)
          : undefined
      }
    >
      {copied ? (
        "Copied!"
      ) : (
        <span className="flex items-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.474l6.733-3.367A2.52 2.52 0 0113 4.5z" />
          </svg>
          Share
        </span>
      )}
    </button>
  );
}
