"use client";

import { useActionState, useState } from "react";
import { requestEmailChange, cancelEmailChange, resendVerificationEmail } from "./actions";

interface EmailSectionProps {
  email: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
}

export function EmailSection({ email, emailVerified, pendingEmail }: EmailSectionProps) {
  const [isCancellingEmail, setIsCancellingEmail] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const [emailState, emailFormAction, isEmailPending] = useActionState(
    requestEmailChange,
    { success: false, message: "" }
  );

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Email Address
      </p>
      {email && !pendingEmail && emailVerified && (
        <p className="mt-1 text-sm text-green-600 dark:text-green-400">
          Verified: {email}
        </p>
      )}
      {email && !pendingEmail && !emailVerified && (
        <div className="mt-1">
          <div className="flex items-center justify-between">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Not verified: {email}
            </p>
            <button
              type="button"
              disabled={isResendingEmail}
              onClick={async () => {
                setIsResendingEmail(true);
                setResendMessage(null);
                try {
                  const result = await resendVerificationEmail();
                  setResendMessage(result.message);
                } finally {
                  setIsResendingEmail(false);
                }
              }}
              className="ml-2 shrink-0 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {isResendingEmail ? "Sending..." : "Resend verification"}
            </button>
          </div>
          {resendMessage && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              {resendMessage}
            </p>
          )}
        </div>
      )}
      {pendingEmail && (
        <div className="mt-1">
          <div className="flex items-center justify-between">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Verification sent to {pendingEmail}
            </p>
            <div className="ml-2 flex shrink-0 gap-2">
              <button
                type="button"
                disabled={isResendingEmail}
                onClick={async () => {
                  setIsResendingEmail(true);
                  setResendMessage(null);
                  try {
                    const result = await resendVerificationEmail();
                    setResendMessage(result.message);
                  } finally {
                    setIsResendingEmail(false);
                  }
                }}
                className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {isResendingEmail ? "Sending..." : "Resend"}
              </button>
              <button
                type="button"
                disabled={isCancellingEmail}
                onClick={async () => {
                  setIsCancellingEmail(true);
                  try {
                    await cancelEmailChange();
                  } finally {
                    setIsCancellingEmail(false);
                  }
                }}
                className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          </div>
          {resendMessage && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              {resendMessage}
            </p>
          )}
        </div>
      )}
      <form action={emailFormAction} className="mt-3 flex gap-2">
        <input
          name="email"
          type="email"
          defaultValue={email ?? ""}
          placeholder="you@example.com"
          className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={isEmailPending}
          className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isEmailPending ? "Sending..." : email ? "Update" : "Add"}
        </button>
      </form>
      {emailState.message && (
        <p
          className={`mt-2 text-xs ${
            emailState.success
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {emailState.message}
        </p>
      )}
    </div>
  );
}
