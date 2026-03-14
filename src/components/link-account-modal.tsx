"use client";

import { useActionState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { linkAccount } from "@/app/profile/account-linking-actions";

interface LinkAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinked?: () => void;
}

export function LinkAccountModal({ isOpen, onClose, onLinked }: LinkAccountModalProps) {
  const { update } = useSession();
  const [state, formAction, isPending] = useActionState(linkAccount, {
    success: false,
    message: "",
  });

  useEffect(() => {
    if (state.success) {
      // Refresh linked accounts in the session
      update({ refreshLinkedAccounts: true });
      onLinked?.();
      onClose();
    }
  }, [state.success, update, onLinked, onClose]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="link-account-modal"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Link another account
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in with the credentials of the account you want to link. You&apos;ll be able to switch between accounts without logging out.
        </p>

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="link-email"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              id="link-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-fuchsia-400 focus:outline-none focus:ring-1 focus:ring-fuchsia-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-fuchsia-500 dark:focus:ring-fuchsia-500"
              placeholder="other@example.com"
              data-testid="link-email-input"
            />
          </div>

          <div>
            <label
              htmlFor="link-password"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              id="link-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-fuchsia-400 focus:outline-none focus:ring-1 focus:ring-fuchsia-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-fuchsia-500 dark:focus:ring-fuchsia-500"
              placeholder="Password"
              data-testid="link-password-input"
            />
          </div>

          {state.message && !state.success && (
            <p className="text-sm text-red-600 dark:text-red-400" data-testid="link-error">
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:from-fuchsia-500 hover:to-blue-500 disabled:opacity-50"
            data-testid="link-account-submit"
          >
            {isPending ? "Linking..." : "Link account"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
