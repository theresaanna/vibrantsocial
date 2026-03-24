"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleNsfwContent } from "@/app/profile/nsfw-actions";
import { Tooltip } from "@/components/tooltip";

interface NsfwToggleProps {
  initialEnabled: boolean;
}

export function NsfwToggle({ initialEnabled }: NsfwToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleToggle = () => {
    startTransition(async () => {
      const result = await toggleNsfwContent();
      setEnabled(result.showNsfwContent);
      router.refresh();
    });
  };

  const label = enabled ? "Hide NSFW content" : "Show NSFW content";

  return (
    <Tooltip label={label}>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`rounded-lg p-1.5 transition-colors ${
          enabled
            ? "text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        } ${isPending ? "opacity-50" : ""}`}
        aria-label={label}
        aria-pressed={enabled}
        data-testid="nsfw-toggle"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      </button>
    </Tooltip>
  );
}
