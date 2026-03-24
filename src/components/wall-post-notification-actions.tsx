"use client";

import { useState, useTransition } from "react";
import { updateWallPostStatus } from "@/app/feed/wall-post-actions";

interface WallPostNotificationActionsProps {
  wallPostId: string;
}

export function WallPostNotificationActions({
  wallPostId,
}: WallPostNotificationActionsProps) {
  const [responded, setResponded] = useState<"accepted" | "hidden" | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  if (responded) {
    return (
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {responded === "accepted" ? "Accepted" : "Hidden"}
      </span>
    );
  }

  function handleAction(status: "accepted" | "hidden") {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("wallPostId", wallPostId);
      formData.set("status", status);
      const result = await updateWallPostStatus(
        { success: false, message: "" },
        formData
      );
      if (result.success) {
        setResponded(status);
      }
    });
  }

  return (
    <div className="mt-1.5 flex gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleAction("accepted")}
        className="relative z-10 rounded-md bg-gradient-to-r from-indigo-500 to-purple-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-all hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50"
      >
        {isPending ? "..." : "Accept"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleAction("hidden")}
        className="relative z-10 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {isPending ? "..." : "Hide"}
      </button>
    </div>
  );
}
