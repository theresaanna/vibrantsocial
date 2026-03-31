"use client";

import { useState } from "react";

export function UpdateBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-fuchsia-50/60 to-blue-50/60 p-4 shadow-sm dark:from-fuchsia-950/20 dark:to-blue-950/20">
      <div className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          A new version of VibrantSocial is available
        </p>
        <p className="mt-1">Refresh the page to get the latest updates.</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-fuchsia-700"
      >
        Refresh
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-200/50 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-300"
        aria-label="Dismiss"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
