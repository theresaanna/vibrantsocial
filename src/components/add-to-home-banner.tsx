"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "vibrantsocial-a2hs-dismissed";

export function AddToHomeBanner() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") return;
    } catch {
      return;
    }

    // Already installed as PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as unknown as { standalone: boolean }).standalone);
    if (isStandalone) return;

    // Detect platform
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) {
      setPlatform("ios");
    } else if (/Android/.test(ua)) {
      setPlatform("android");
    } else {
      // Not a target mobile platform
      return;
    }

    setVisible(true);
  }, []);

  function handleDismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Private browsing or quota exceeded
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-fuchsia-50/60 to-blue-50/60 p-4 shadow-sm md:hidden dark:from-fuchsia-950/20 dark:to-blue-950/20">
      <div className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          Add VibrantSocial to your home screen
        </p>
        <p className="mt-1">
          {platform === "ios" ? (
            <>
              Tap the share button{" "}
              <span className="inline-flex translate-y-0.5">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0016.5 8.25H15M12 15V2.25m0 0l3 3m-3-3l-3 3" />
                </svg>
              </span>{" "}
              then &ldquo;Add to Home Screen&rdquo;
            </>
          ) : (
            <>
              Tap the menu{" "}
              <span className="inline-block w-4 text-center font-bold leading-none">&#8942;</span>{" "}
              then &ldquo;Add to Home Screen&rdquo;
            </>
          )}
        </p>
      </div>
      <button
        onClick={handleDismiss}
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
