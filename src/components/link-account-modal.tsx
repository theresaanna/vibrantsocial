"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { signIn, useSession } from "next-auth/react";
import { linkAccount, startOAuthLink } from "@/app/profile/account-linking-actions";

interface LinkAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinked?: () => void;
}

export function LinkAccountModal({ isOpen, onClose, onLinked }: LinkAccountModalProps) {
  const { update } = useSession();
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
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

  async function handleOAuthLink(provider: string) {
    setOauthLoading(provider);
    try {
      const result = await startOAuthLink(provider);
      if (result.success) {
        // Cookie is set — now redirect to OAuth provider
        signIn(provider, { callbackUrl: "/profile" });
      }
    } catch {
      setOauthLoading(null);
    }
  }

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
          Link another VibrantSocial account to switch between them without logging out.
        </p>

        {/* OAuth provider buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleOAuthLink("google")}
            disabled={oauthLoading !== null}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            data-testid="link-google-button"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {oauthLoading === "google" ? "Redirecting..." : "Link with Google"}
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLink("discord")}
            disabled={oauthLoading !== null}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            data-testid="link-discord-button"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#5865F2">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            {oauthLoading === "discord" ? "Redirecting..." : "Link with Discord"}
          </button>
        </div>

        {/* Divider */}
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
          <span className="text-xs text-zinc-400">or sign in with credentials</span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        </div>

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
