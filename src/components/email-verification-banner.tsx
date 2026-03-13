"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { resendVerificationEmail } from "@/app/profile/actions";

export function EmailVerificationBanner() {
  const { data: session, update } = useSession();
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [dismissed, setDismissed] = useState(false);

  if (!session?.user || session.user.isEmailVerified || dismissed) return null;

  async function handleResend() {
    setStatus("sending");
    try {
      const result = await resendVerificationEmail();
      setStatus(result.success ? "sent" : "error");
      if (result.success) {
        // Refresh session in case email was just verified
        await update();
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      <div className="flex items-center justify-center gap-2">
        <span>
          Please verify your email address. Check your inbox for a verification
          link.
        </span>
        {status === "idle" && (
          <button
            onClick={handleResend}
            className="font-medium underline hover:no-underline"
          >
            Resend
          </button>
        )}
        {status === "sending" && (
          <span className="text-amber-600 dark:text-amber-300">
            Sending...
          </span>
        )}
        {status === "sent" && (
          <span className="text-green-700 dark:text-green-400">Sent!</span>
        )}
        {status === "error" && (
          <button
            onClick={handleResend}
            className="font-medium text-red-700 underline hover:no-underline dark:text-red-400"
          >
            Failed, try again
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="ml-2 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
          aria-label="Dismiss"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
