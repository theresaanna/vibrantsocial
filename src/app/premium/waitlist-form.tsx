"use client";

import { useActionState } from "react";
import { joinPremiumWaitlist } from "./actions";

export function WaitlistForm() {
  const [state, formAction, isPending] = useActionState(joinPremiumWaitlist, {
    success: false,
    message: "",
  });

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          required
          disabled={isPending || state.success}
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400"
        />
        <button
          type="submit"
          disabled={isPending || state.success}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
        >
          {isPending ? "Joining..." : "Notify Me"}
        </button>
      </div>
      {state.message && (
        <p className={`text-sm ${state.success ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
