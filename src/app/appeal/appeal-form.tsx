"use client";

import { useActionState } from "react";
import { submitAppeal, type AppealState } from "./actions";

const initialState: AppealState = { success: false, message: "" };

export function AppealForm({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [state, formAction, isPending] = useActionState(submitAppeal, initialState);

  if (state.success) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {!isLoggedIn && (
        <>
          <input type="hidden" name="type" value="suspension" />
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Account email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="you@example.com"
            />
          </div>
        </>
      )}

      {isLoggedIn && (
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            What are you appealing?
          </label>
          <select
            id="type"
            name="type"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="content_warning">Content warning on my post</option>
            <option value="suspension">Account suspension</option>
          </select>
        </div>
      )}

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Why should this decision be reversed?
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={4}
          maxLength={2000}
          className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="Explain why you believe the moderation action was incorrect..."
        />
      </div>

      {state.message && !state.success && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Submitting..." : "Submit Appeal"}
      </button>
    </form>
  );
}
