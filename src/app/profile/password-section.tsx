"use client";

import { useActionState } from "react";
import { changePassword } from "./actions";

interface PasswordSectionProps {
  isCredentialsUser: boolean;
}

export function PasswordSection({ isCredentialsUser }: PasswordSectionProps) {
  const [state, formAction, isPending] = useActionState(changePassword, {
    success: false,
    message: "",
  });

  if (!isCredentialsUser) return null;

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Change Password
      </p>
      <form action={formAction} className="mt-3 space-y-3">
        <div>
          <label
            htmlFor="currentPassword"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            data-testid="current-password-input"
          />
        </div>
        <div>
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            data-testid="new-password-input"
          />
        </div>
        <div>
          <label
            htmlFor="confirmNewPassword"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Confirm new password
          </label>
          <input
            id="confirmNewPassword"
            name="confirmNewPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            data-testid="confirm-new-password-input"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          data-testid="change-password-submit"
        >
          {isPending ? "Changing..." : "Change Password"}
        </button>
      </form>
      {state.message && (
        <p
          className={`mt-2 text-xs ${
            state.success
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
          data-testid="change-password-message"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
