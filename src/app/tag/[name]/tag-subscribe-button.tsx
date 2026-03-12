"use client";

import { useState, useTransition } from "react";
import {
  toggleTagSubscription,
  updateTagSubscriptionFrequency,
} from "@/app/feed/tag-subscription-actions";

interface TagSubscribeButtonProps {
  tagId: string;
  tagName: string;
  initialSubscribed: boolean;
  initialFrequency: string;
}

export function TagSubscribeButton({
  tagId,
  tagName,
  initialSubscribed,
  initialFrequency,
}: TagSubscribeButtonProps) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [frequency, setFrequency] = useState(initialFrequency);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    setSubscribed((prev) => !prev);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tagId", tagId);
      const result = await toggleTagSubscription(
        { success: false, message: "" },
        formData
      );
      if (!result.success) {
        setSubscribed((prev) => !prev);
      }
    });
  }

  function handleFrequencyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newFrequency = e.target.value;
    const oldFrequency = frequency;
    setFrequency(newFrequency);
    startTransition(async () => {
      const result = await updateTagSubscriptionFrequency(tagId, newFrequency);
      if (!result.success) {
        setFrequency(oldFrequency);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
          subscribed
            ? "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-400 dark:hover:bg-fuchsia-900/50"
            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        }`}
        aria-label={
          subscribed
            ? `Unsubscribe from #${tagName}`
            : `Subscribe to #${tagName}`
        }
      >
        <svg
          className="h-4 w-4"
          fill={subscribed ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {subscribed ? "Subscribed" : "Subscribe"}
      </button>
      {subscribed && (
        <select
          value={frequency}
          onChange={handleFrequencyChange}
          disabled={isPending}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 transition-colors hover:border-zinc-300 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
        >
          <option value="immediate">Immediate</option>
          <option value="digest">Daily Digest</option>
        </select>
      )}
    </div>
  );
}
