"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startConversation } from "@/app/chat/actions";

interface MessageButtonProps {
  userId: string;
  hasCustomTheme?: boolean;
}

export function MessageButton({ userId, hasCustomTheme }: MessageButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    setIsPending(true);
    try {
      const result = await startConversation(userId);
      if (result.success && result.conversationId) {
        router.push(`/chat/${result.conversationId}`);
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        hasCustomTheme
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
      data-testid="message-button"
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
      {isPending ? "Opening…" : "Message"}
    </button>
  );
}
