"use client";

import { useState, useEffect, useRef } from "react";
import {
  fetchFeedSummary,
  generateFeedSummaryOnDemand,
} from "@/app/feed/summary-actions";

interface FeedSummaryBannerProps {
  lastSeenFeedAt: string;
}

export function FeedSummaryBanner({ lastSeenFeedAt }: FeedSummaryBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tooMany, setTooMany] = useState(false);
  const [missedCount, setMissedCount] = useState(0);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Guard against double-fetch from StrictMode or component remounts
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetchFeedSummary(lastSeenFeedAt).then((result) => {
      setSummary(result.summary);
      setTooMany(result.tooMany);
      setMissedCount(result.missedCount);
      setChecked(true);
    });
  }, [lastSeenFeedAt]);

  async function handleSummarize() {
    setGenerating(true);
    try {
      const result = await generateFeedSummaryOnDemand(lastSeenFeedAt);
      setSummary(
        result ?? "Your friends have been posting! Scroll down to see what's new."
      );
      setTooMany(false);
    } catch {
      setSummary("Your friends have been posting! Scroll down to see what's new.");
    } finally {
      setGenerating(false);
    }
  }

  // Don't render anything until the initial check completes
  if (!checked) return null;
  if (dismissed) return null;
  if (!summary && missedCount === 0) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-fuchsia-50 to-blue-50 p-4 shadow-sm dark:from-fuchsia-950/30 dark:to-blue-950/30">
      <div className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          While you were away&hellip;
        </p>

        {generating && (
          <div className="mt-2 space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        )}

        {!generating && summary && <p className="mt-1">{summary}</p>}

        {!generating && !summary && missedCount > 0 && (
          <div className="mt-1">
            <p>You have {tooMany ? `${missedCount}+` : missedCount} new {missedCount === 1 ? "post" : "posts"} in your feed!</p>
            <button
              onClick={handleSummarize}
              className="mt-2 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-fuchsia-700"
            >
              Summarize what I missed
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-200/50 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-300"
        aria-label="Dismiss"
      >
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
