"use client";

import { useState } from "react";
import { sendChatRequest, cancelChatRequest, type ChatRequestStatus } from "@/app/chat/actions";

interface ChatRequestButtonProps {
  userId: string;
  initialStatus: ChatRequestStatus;
  hasCustomTheme?: boolean;
}

export function ChatRequestButton({ userId, initialStatus, hasCustomTheme }: ChatRequestButtonProps) {
  const [status, setStatus] = useState<ChatRequestStatus>(initialStatus);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  // Don't render if already friends or has conversation (MessageButton handles those)
  if (status === "friends" || status === "has_conversation" || status === "accepted") {
    return null;
  }

  const isPendingStatus = status === "pending";

  const handleClick = async () => {
    setIsPending(true);
    setError("");
    try {
      if (isPendingStatus) {
        const result = await cancelChatRequest(userId);
        if (result.success) {
          setStatus("none");
        } else {
          setError(result.message);
        }
      } else {
        const result = await sendChatRequest(userId);
        if (result.success) {
          setStatus("pending");
        } else {
          setError(result.message);
        }
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isPending}
        data-testid="chat-request-button"
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
          isPendingStatus
            ? hasCustomTheme
              ? ""
              : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40"
            : hasCustomTheme
              ? ""
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        }`}
        style={
          hasCustomTheme
            ? ({
                borderColor: "var(--profile-secondary)",
                color: "var(--profile-text)",
              } as React.CSSProperties)
            : undefined
        }
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M3.43 2.524A41.29 41.29 0 0110 2c2.236 0 4.43.18 6.57.524 1.437.231 2.43 1.49 2.43 2.902v5.148c0 1.413-.993 2.67-2.43 2.902a41.202 41.202 0 01-3.55.414c-.28.02-.521.18-.643.413l-1.712 3.293a.75.75 0 01-1.33 0l-1.713-3.293a.783.783 0 00-.642-.413 41.202 41.202 0 01-3.55-.414C1.993 13.245 1 11.986 1 10.574V5.426c0-1.413.993-2.67 2.43-2.902z"
            clipRule="evenodd"
          />
        </svg>
        {isPending
          ? isPendingStatus ? "Cancelling…" : "Sending…"
          : isPendingStatus ? "Chat Requested" : "Chat Request"}
      </button>
      {error && (
        <p className="mt-1 text-xs text-red-500" data-testid="chat-request-error">{error}</p>
      )}
    </div>
  );
}
