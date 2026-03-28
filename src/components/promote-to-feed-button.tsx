"use client";

import { useState, useTransition } from "react";
import { promoteToFeed } from "@/app/marketplace/actions";

interface PromoteToFeedButtonProps {
  postId: string;
  isPromoted: boolean;
}

export function PromoteToFeedButton({ postId, isPromoted }: PromoteToFeedButtonProps) {
  const [promoted, setPromoted] = useState(isPromoted);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await promoteToFeed(postId);
      if (result.success) {
        setPromoted(!promoted);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        promoted
          ? "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-700 dark:bg-pink-900/30 dark:text-pink-400"
          : "border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:text-zinc-400"
      } disabled:opacity-50`}
      title={promoted ? "Remove from feed" : "Promote to feed"}
      data-testid="promote-to-feed-button"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      {promoted ? "In Feed" : "Promote to Feed"}
    </button>
  );
}
