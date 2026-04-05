"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "vibrantsocial-add-email-dismissed";

export function AddEmailBanner({ hasEmail }: { hasEmail: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasEmail) return;

    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") return;
    } catch {
      return;
    }

    setVisible(true);
  }, [hasEmail]);

  function handleDismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Private browsing or quota exceeded
    }
    setVisible(false);
  }

  return (
    <div
      className={`grid transition-all duration-300 ease-out ${
        visible
          ? "grid-rows-[1fr] opacity-100"
          : "grid-rows-[0fr] opacity-0"
      }`}
    >
    <div className="overflow-hidden">
    <div className="mb-4 flex items-start gap-3 rounded-2xl bg-zinc-50 p-4 shadow-sm dark:bg-zinc-800">
      <div className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          Add an email to your account
        </p>
        <p className="mt-1">
          Get notifications and recover your account.{" "}
          <Link href="/profile" className="font-medium underline">
            Add email
          </Link>
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
    </div>
    </div>
  );
}
