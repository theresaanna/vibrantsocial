"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToChatRequestByActor } from "@/app/messages/actions";

interface ChatRequestNotificationActionsProps {
  actorId: string;
  onRespond?: () => void;
}

export function ChatRequestNotificationActions({
  actorId,
  onRespond,
}: ChatRequestNotificationActionsProps) {
  const [responded, setResponded] = useState<"accepted" | "declined" | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (responded) {
    return (
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {responded === "accepted" ? "Accepted" : "Declined"}
      </span>
    );
  }

  function handleAction(action: "accept" | "decline") {
    startTransition(async () => {
      const result = await respondToChatRequestByActor(actorId, action);
      if (result.success) {
        setResponded(action === "accept" ? "accepted" : "declined");
        onRespond?.();
        if (action === "accept" && result.conversationId) {
          router.push(`/messages/${result.conversationId}`);
        }
      }
    });
  }

  return (
    <div className="mt-1.5 flex gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleAction("accept")}
        className="relative z-10 rounded-md bg-gradient-to-r from-fuchsia-500 to-pink-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-all hover:from-fuchsia-600 hover:to-pink-600 disabled:opacity-50"
      >
        {isPending ? "..." : "Accept"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleAction("decline")}
        className="relative z-10 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {isPending ? "..." : "Decline"}
      </button>
    </div>
  );
}
