"use client";

import type { ChatUserProfile } from "@/types/chat";

interface TypingIndicatorProps {
  typingUserIds: Set<string>;
  participants: Map<string, ChatUserProfile>;
  currentUserId: string;
}

export function TypingIndicator({
  typingUserIds,
  participants,
  currentUserId,
}: TypingIndicatorProps) {
  const others = [...typingUserIds].filter((id) => id !== currentUserId);

  if (others.length === 0) return null;

  const names = others.map((id) => {
    const p = participants.get(id);
    return p?.displayName ?? p?.username ?? p?.name ?? "Someone";
  });

  let text: string;
  if (names.length === 1) {
    text = `${names[0]} is typing`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing`;
  } else {
    text = `${names.length} people are typing`;
  }

  return (
    <div className="flex items-center gap-1.5 px-4 py-1 text-xs text-zinc-500 dark:text-zinc-400">
      <span className="flex gap-0.5">
        <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
      </span>
      <span>{text}</span>
    </div>
  );
}
