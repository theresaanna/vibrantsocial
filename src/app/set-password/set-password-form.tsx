"use client";

import { useActionState } from "react";
import Link from "next/link";
import { setInitialPassword } from "./actions";

export function SetPasswordForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction, isPending] = useActionState(setInitialPassword, {
    success: false,
    message: "",
  });

  if (state.success) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            {state.message}
          </p>
        </div>
        <p className="text-center">
          <Link
            href="/profile"
            className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Back to your profile
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="At least 8 characters"
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Setting password..." : "Set password"}
      </button>

      {state.message && !state.success && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
    </form>
  );
}
