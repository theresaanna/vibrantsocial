"use client";

import { useState } from "react";
import { requestPasswordSetupEmail } from "./actions";

interface Props {
  isCredentialsUser: boolean;
}

/**
 * Shown only to OAuth-only users (`!isCredentialsUser`) — sibling of
 * `PasswordSection` which handles the change-password flow for users
 * who already have one. Kicks off the email-confirmed
 * /set-password flow via `requestPasswordSetupEmail()`.
 */
export function PasswordSetupSection({ isCredentialsUser }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<
    { success: boolean; message: string } | null
  >(null);

  if (isCredentialsUser) return null;

  async function handleClick() {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await requestPasswordSetupEmail();
      setResult(res);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Set a password
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Your account uses social sign-in. Add a password as a second way
        to get in — useful if you ever need to disconnect a social
        service.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        data-testid="password-setup-submit"
      >
        {isLoading ? "Sending..." : "Send setup link"}
      </button>
      {result?.message && (
        <p
          className={`mt-2 text-xs ${
            result.success
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
          data-testid="password-setup-message"
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
