"use client";

import { useState } from "react";
import { requestPasswordChangeEmail } from "./actions";

interface PasswordSectionProps {
  isCredentialsUser: boolean;
}

export function PasswordSection({ isCredentialsUser }: PasswordSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isCredentialsUser) return null;

  async function handleClick() {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await requestPasswordChangeEmail();
      setResult(res);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Change Password
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        We&apos;ll send a password reset link to your email address.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        data-testid="change-password-submit"
      >
        {isLoading ? "Sending..." : "Send Reset Link"}
      </button>
      {result?.message && (
        <p
          className={`mt-2 text-xs ${
            result.success
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
          data-testid="change-password-message"
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
