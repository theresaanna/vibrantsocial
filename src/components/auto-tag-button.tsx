"use client";

import { useState, useEffect } from "react";
import { suggestTags } from "@/app/feed/auto-tag-action";

const HINT_DISMISSED_KEY = "autotag-hint-dismissed";

interface AutoTagButtonProps {
  editorJson: string;
  existingTags: string[];
  onTagsSuggested: (tags: string[]) => void;
  disabled?: boolean;
}

export function AutoTagButton({
  editorJson,
  existingTags,
  onTagsSuggested,
  disabled,
}: AutoTagButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(HINT_DISMISSED_KEY)) {
        setShowHint(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  function dismissHint() {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_DISMISSED_KEY, "1");
    } catch {
      // localStorage unavailable
    }
  }

  async function handleClick() {
    dismissHint();
    setIsLoading(true);
    setError(null);

    try {
      const result = await suggestTags(editorJson);
      if (result.success) {
        const merged = [...new Set([...existingTags, ...result.tags])];
        onTagsSuggested(merged);
      } else {
        setError(result.error || "Failed to suggest tags");
      }
    } catch {
      setError("Failed to suggest tags");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative inline-flex items-center">
      {showHint && (
        <div className="absolute bottom-full right-0 z-20 mb-2 w-52 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Use AI to auto-suggest tags for your post!
          </p>
          <button
            type="button"
            onClick={dismissHint}
            className="mt-2 text-xs font-medium text-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-400"
          >
            Got it
          </button>
          <div className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800" />
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isLoading || !editorJson}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-yellow-50 hover:text-yellow-500 disabled:opacity-50 dark:hover:bg-yellow-900/20 dark:hover:text-yellow-500"
        title="Auto-suggest tags with AI"
        data-testid="auto-tag-button"
      >
        <span data-testid="auto-tag-label">
          {isLoading ? "Generating..." : "Generate tags"}
        </span>
        {isLoading ? (
          <svg
            className="h-5 w-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
        )}
      </button>
      {error && (
        <span
          className="ml-1 text-xs text-red-500"
          data-testid="auto-tag-error"
        >
          {error}
        </span>
      )}
    </div>
  );
}
