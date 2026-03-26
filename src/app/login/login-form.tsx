"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginWithCredentials } from "./actions";
import { TurnstileWidget } from "@/components/turnstile-widget";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginWithCredentials,
    { success: false, message: "" }
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm text-fuchsia-600 hover:underline dark:text-fuchsia-400"
        >
          Forgot password?
        </Link>
      </div>

      <TurnstileWidget />

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:from-fuchsia-500 hover:to-blue-500 disabled:opacity-50"
      >
        {isPending ? "Signing in..." : "Sign In"}
      </button>

      {state.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
    </form>
  );
}
