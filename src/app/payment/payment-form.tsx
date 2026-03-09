"use client";

import { useState } from "react";

interface PaymentFormProps {
  canceled?: boolean;
}

export function PaymentForm({ canceled }: PaymentFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    canceled ? "Payment was canceled. You can try again." : null
  );

  async function handlePayment() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start checkout");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Age Verification Fee
          </span>
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            $2.99
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          One-time payment &middot; Non-refundable
        </p>
      </div>

      <button
        onClick={handlePayment}
        disabled={isLoading}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isLoading ? "Redirecting to checkout..." : "Pay $2.99"}
      </button>

      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
        You will be redirected to Stripe&apos;s secure checkout page.
      </p>

      {error && (
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
