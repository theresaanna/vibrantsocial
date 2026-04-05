"use client";

import { useState, useEffect, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  toggleNsfwContent,
  getNsfwContentSetting,
} from "@/app/profile/nsfw-actions";
import { Tooltip } from "@/components/tooltip";

interface NsfwToggleProps {
  /** When provided, skips the client-side fetch. */
  initialEnabled?: boolean;
}

/**
 * Self-initialising NSFW toggle. Lives in the synchronous Header shell so
 * there is always exactly one instance in the DOM (no Suspense duplication).
 * If `initialEnabled` is omitted the component fetches its own state on mount.
 */
export function NsfwToggle({ initialEnabled }: NsfwToggleProps = {}) {
  const { data: session, status } = useSession();
  const [enabled, setEnabled] = useState(initialEnabled ?? false);
  const [loaded, setLoaded] = useState(initialEnabled !== undefined);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Fetch initial NSFW setting when no server-provided value
  useEffect(() => {
    if (initialEnabled === undefined && status === "authenticated") {
      getNsfwContentSetting().then((value) => {
        setEnabled(value);
        setLoaded(true);
      });
    }
  }, [initialEnabled, status]);

  // Don't render for logged-out users or while still loading state
  if (status === "loading" || !session?.user || !loaded) {
    return null;
  }

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
