"use client";

import { ConversationList } from "@/components/chat/conversation-list";
import { MessageRequestList } from "@/components/chat/message-request-list";
import type { ConversationListItem, MessageRequestData } from "@/types/chat";

interface ChatPageClientProps {
  conversations: ConversationListItem[];
  messageRequests: MessageRequestData[];
}

export function ChatPageClient({
  conversations,
  messageRequests,
}: ChatPageClientProps) {
  return (
    <main
      className="mx-auto flex max-w-5xl px-4 py-6"
      style={{ height: "calc(100vh - 57px)" }}
    >
      {/* Sidebar */}
      <div className="flex w-80 flex-shrink-0 flex-col overflow-hidden rounded-l-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <ConversationList conversations={conversations} />
        <MessageRequestList requests={messageRequests} />
      </div>

      {/* Empty state */}
      <div className="flex flex-1 items-center justify-center rounded-r-2xl border border-l-0 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-zinc-400">
              <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 3.96 1 5.32v5.36c0 1.36.993 2.565 2.43 2.796a41.5 41.5 0 002.07.261V17a1 1 0 001.537.844l2.936-1.908A41.18 41.18 0 0010 16c2.236 0 4.43-.18 6.57-.524C18.007 15.245 19 14.04 19 12.68V7.32c0-1.36-.993-2.565-2.43-2.796A41.47 41.47 0 0010 4V2z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Select a conversation to start messaging
          </p>
        </div>
      </div>
    </main>
  );
}
