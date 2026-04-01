"use client";

import { useRef, useState, useTransition } from "react";
import { setStatusAndReturn } from "@/app/feed/status-actions";
import type { FriendStatusData } from "@/app/feed/status-actions";

interface StatusComposerProps {
  onStatusCreated?: (status: FriendStatusData) => void;
}

export function StatusComposer({ onStatusCreated }: StatusComposerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const content = (formData.get("content") as string | null)?.trim() ?? "";
    if (!content) {
      setError("Status cannot be empty.");
      return;
    }

    startTransition(async () => {
      setError("");
      const status = await setStatusAndReturn(content);
      if (status) {
        formRef.current?.reset();
        onStatusCreated?.(status);
      } else {
        setError("Failed to set status. Try again.");
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex gap-2">
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
      {error && (
        <p className="self-center text-xs text-red-500">{error}</p>
      )}
    </form>
  );
}
