"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FramedAvatar } from "@/components/framed-avatar";
import { PresenceIndicator } from "@/components/chat/presence-indicator";
import { startConversation } from "@/app/messages/actions";
import type { ChatUserProfile } from "@/types/chat";
import { StyledName } from "@/components/styled-name";

interface ChatFriendsListProps {
  friends: ChatUserProfile[];
  onlineUserIds?: Set<string>;
}

export function ChatFriendsList({ friends, onlineUserIds = new Set() }: ChatFriendsListProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (friends.length === 0) return null;

  const handleStartChat = (userId: string) => {
    setLoadingId(userId);
    startTransition(async () => {
      const result = await startConversation(userId);
      if (result.success && result.conversationId) {
        router.push(`/messages/${result.conversationId}`);
      }
      setLoadingId(null);
    });
  };

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
      >
        <span className="flex items-center gap-2">
          Friends
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 px-1.5 text-xs font-medium text-white">
            {friends.length}
          </span>
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isExpanded && (
        <div className="px-2 pb-2">
          {friends.map((friend) => {
            const displayName = friend.displayName ?? friend.username ?? friend.name ?? "User";
            const avatar = friend.avatar ?? friend.image;
            const initial = displayName[0]?.toUpperCase() || "?";
            const isOnline = onlineUserIds.has(friend.id);
            const isLoading = loadingId === friend.id;

            return (
              <button
                key={friend.id}
                onClick={() => handleStartChat(friend.id)}
                disabled={isPending}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800/50"
              >
                <div className="relative flex-shrink-0">
                  <FramedAvatar
                    src={avatar}
                    alt={displayName}
                    initial={initial}
                    size={36}
                    frameId={friend.profileFrameId}
                  />
                  {isOnline && (
                    <PresenceIndicator isOnline size="sm" />
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {isLoading ? "Opening..." : <StyledName fontId={friend.usernameFont}>{displayName}</StyledName>}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0 text-zinc-400">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
