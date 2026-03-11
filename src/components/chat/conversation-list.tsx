"use client";

import { useState } from "react";
import { ConversationItem } from "./conversation-item";
import { NewConversationModal } from "./new-conversation-modal";
import type { ConversationListItem, ChatThemeColors } from "@/types/chat";

interface ConversationListProps {
  conversations: ConversationListItem[];
  activeId?: string;
  onlineUserIds?: Set<string>;
  themeColors?: ChatThemeColors;
}

export function ConversationList({
  conversations,
  activeId,
  onlineUserIds = new Set(),
  themeColors,
}: ConversationListProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600">
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Messages
          </h2>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className={`rounded-lg p-2 transition-colors ${
            themeColors?.bgColor
              ? "chat-btn-themed"
              : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          }`}
          aria-label="New message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
            <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25h5.5a.75.75 0 010 1.5h-5.5a.25.25 0 00-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25v-5.5a.75.75 0 011.5 0v5.5a1.75 1.75 0 01-1.75 1.75h-8.5a1.75 1.75 0 01-1.75-1.75v-8.5z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No conversations yet
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 text-sm font-medium text-blue-500 hover:text-blue-600"
            >
              Start a conversation
            </button>
          </div>
        ) : (
          conversations.map((conv) => {
            const otherUserId = conv.isGroup ? undefined : conv.participants[0]?.id;
            return (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeId}
                isOnline={otherUserId ? onlineUserIds.has(otherUserId) : false}
                themeColors={themeColors}
              />
            );
          })
        )}
      </div>

      {showModal && <NewConversationModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
