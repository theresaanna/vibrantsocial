"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startConversation } from "@/app/messages/actions";

interface StatusReplyButtonProps {
  /** The user who posted the status */
  userId: string;
  /** The status text to quote in the chat */
  statusContent: string;
  /** Display name of the status author, used for the quoted text */
  authorName: string;
}

export function StatusReplyButton({
  userId,
  statusContent,
  authorName,
}: StatusReplyButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    setIsPending(true);
    try {
      const result = await startConversation(userId);
      if (result.success && result.conversationId) {
        const quote = `Replying to ${authorName}'s status: "${statusContent}"\n\n`;
        router.push(
          `/messages/${result.conversationId}?statusReply=${encodeURIComponent(quote)}`
        );
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-0.5 text-xs text-zinc-400 transition-colors hover:text-indigo-500 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-indigo-400"
      aria-label="Reply to status via chat"
      data-testid="status-reply-button"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-3.5 w-3.5"
      >
        <path
          fillRule="evenodd"
          d="M3.43 2.524A41.29 41.29 0 0110 2c2.236 0 4.43.18 6.57.524 1.437.231 2.43 1.49 2.43 2.902v5.148c0 1.413-.993 2.67-2.43 2.902a41.202 41.202 0 01-3.55.414c-.28.02-.521.18-.643.413l-1.712 3.293a.75.75 0 01-1.33 0l-1.713-3.293a.783.783 0 00-.642-.413 41.202 41.202 0 01-3.55-.414C1.993 13.245 1 11.986 1 10.574V5.426c0-1.413.993-2.67 2.43-2.902z"
          clipRule="evenodd"
        />
      </svg>
      {isPending ? "..." : "Reply"}
    </button>
  );
}
