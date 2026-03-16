"use client";

import { useState, useCallback } from "react";
import { subscribeToPremiumNotify } from "@/app/profile/notify-actions";

interface PremiumComingSoonProps {
  defaultEmail?: string | null;
}

export function PremiumComingSoon({ defaultEmail }: PremiumComingSoonProps) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim() || status === "loading") return;

      setStatus("loading");
      const result = await subscribeToPremiumNotify(email);
      setMessage(result.message);
      setStatus(result.success ? "done" : "idle");
    },
    [email, status]
  );

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-fuchsia-600 dark:text-fuchsia-400">
        Premium is coming soon!
      </p>

      {status === "done" ? (
        <p className="text-xs text-green-600 dark:text-green-400">{message}</p>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              required
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="whitespace-nowrap rounded-lg bg-fuchsia-50 px-3 py-1.5 text-sm font-medium text-fuchsia-600 transition-colors hover:bg-fuchsia-100 disabled:opacity-50 dark:bg-fuchsia-900/20 dark:text-fuchsia-400 dark:hover:bg-fuchsia-900/30"
            >
              {status === "loading" ? "..." : "Notify Me"}
            </button>
          </form>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            We&apos;ll only send you one email when it&apos;s available.
          </p>
          {message && status === "idle" && (
            <p className="text-xs text-red-500">{message}</p>
          )}
        </>
      )}
    </div>
  );
}
