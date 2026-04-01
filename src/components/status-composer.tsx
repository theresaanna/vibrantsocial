"use client";

import { useActionState, useRef, useEffect } from "react";
import { setStatus } from "@/app/feed/status-actions";

export function StatusComposer() {
  const [state, formAction, isPending] = useActionState(setStatus, {
    success: false,
    message: "",
  });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex gap-2">
      <input
        name="content"
        type="text"
        maxLength={280}
        placeholder="What's on your mind?"
        className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        data-testid="status-input"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
        data-testid="status-submit"
      >
        {isPending ? "..." : "Set status"}
      </button>
      {state.message && !state.success && (
        <p className="self-center text-xs text-red-500">{state.message}</p>
      )}
    </form>
  );
}
