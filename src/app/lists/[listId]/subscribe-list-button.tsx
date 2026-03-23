"use client";

import { useActionState } from "react";
import { toggleListSubscription } from "../actions";

interface SubscribeListButtonProps {
  listId: string;
  isSubscribed: boolean;
}

export function SubscribeListButton({ listId, isSubscribed }: SubscribeListButtonProps) {
  const [, formAction, isPending] = useActionState(toggleListSubscription, {
    success: false,
    message: "",
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="listId" value={listId} />
      {isSubscribed ? (
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white shadow-sm ring-2 ring-indigo-400/30 transition-all hover:from-indigo-600 hover:to-violet-600 hover:shadow-md disabled:opacity-50"
        >
          {isPending ? "..." : "Subscribed"}
        </button>
      ) : (
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border-2 border-indigo-500 bg-transparent px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-indigo-600 transition-all hover:bg-indigo-50 hover:shadow-sm disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
        >
          {isPending ? "..." : "Subscribe"}
        </button>
      )}
    </form>
  );
}
