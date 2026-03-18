"use client";

import { useActionState, useState } from "react";
import { submitStrikeAppeal } from "./actions";

export function AppealForm({ violationId }: { violationId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(submitStrikeAppeal, {
    success: false,
    message: "",
  });

  if (state.success) {
    return (
      <p className="text-sm text-green-600 dark:text-green-400">
        {state.message}
      </p>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm font-medium text-blue-500 hover:text-blue-600"
      >
        Contest this strike
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="violationId" value={violationId} />
      <textarea
        name="reason"
        placeholder="Explain why you believe this flag was made in error..."
        required
        minLength={10}
        maxLength={2000}
        rows={3}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
      {state.message && !state.success && (
        <p className="text-sm text-red-500">{state.message}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Submitting..." : "Submit Appeal"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
