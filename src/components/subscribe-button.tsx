"use client";

import { useActionState } from "react";
import { togglePostSubscription } from "@/app/feed/subscription-actions";

interface SubscribeButtonProps {
  userId: string;
  isSubscribed: boolean;
  size?: "default" | "sm";
}

export function SubscribeButton({ userId, isSubscribed }: SubscribeButtonProps) {
  const [, formAction, isPending] = useActionState(togglePostSubscription, {
    success: false,
    message: "",
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={isPending}
        title={isSubscribed ? "Unsubscribe from new posts" : "Get notified of new posts"}
        className={`rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-all disabled:opacity-50 ${
          isSubscribed
            ? "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            : "border border-zinc-300 bg-white text-zinc-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-600 dark:bg-transparent dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
        }`}
      >
        {isPending ? "..." : isSubscribed ? (
          <>
            <svg className="mr-1 -ml-0.5 inline h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            Subscribed
          </>
        ) : (
          <>
            <svg className="mr-1 -ml-0.5 inline h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            Subscribe
          </>
        )}
      </button>
    </form>
  );
}
