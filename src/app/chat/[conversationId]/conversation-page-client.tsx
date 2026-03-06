"use client";

import { useState, useEffect } from "react";
import { ChannelProvider } from "ably/react";
import { ConversationList } from "@/components/chat/conversation-list";
import { MessageRequestList } from "@/components/chat/message-request-list";
import { MessageThread } from "@/components/chat/message-thread";
import { useAblyReady } from "@/app/providers";
import { getConversations } from "@/app/chat/actions";
import type {
  ConversationListItem,
  MessageRequestData,
  MessageData,
  ConversationWithParticipants,
} from "@/types/chat";

interface ConversationPageClientProps {
  conversationId: string;
  conversations: ConversationListItem[];
  messageRequests: MessageRequestData[];
  initialMessages: MessageData[];
  conversation: ConversationWithParticipants;
  currentUserId: string;
  phoneVerified: boolean;
}

export function ConversationPageClient({
  conversationId,
  conversations,
  messageRequests,
  initialMessages,
  conversation,
  currentUserId,
  phoneVerified,
}: ConversationPageClientProps) {
  const ablyReady = useAblyReady();
  const [liveConversations, setLiveConversations] = useState(conversations);

  // Refresh sidebar on focus and periodically
  useEffect(() => {
    const refresh = () => getConversations().then(setLiveConversations);
    const handleFocus = () => refresh();
    window.addEventListener("focus", handleFocus);
    const interval = setInterval(refresh, 15000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, []);

  return (
    <main
      className="mx-auto flex max-w-5xl px-4 py-6"
      style={{ height: "calc(100vh - 57px)" }}
    >
      {/* Sidebar */}
      <div className="flex w-80 flex-shrink-0 flex-col overflow-hidden rounded-l-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <ConversationList
          conversations={liveConversations}
          activeId={conversationId}
        />
        <MessageRequestList requests={messageRequests} />
      </div>

      {/* Message thread */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-r-2xl border border-l-0 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {ablyReady ? (
          <ChannelProvider channelName={`chat:${conversationId}`}>
            <ChannelProvider channelName={`typing:${conversationId}`}>
              <ChannelProvider channelName={`read:${conversationId}`}>
                <MessageThread
                  conversationId={conversationId}
                  initialMessages={initialMessages}
                  conversation={conversation}
                  currentUserId={currentUserId}
                  phoneVerified={phoneVerified}
                />
              </ChannelProvider>
            </ChannelProvider>
          </ChannelProvider>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-zinc-400">Connecting...</p>
          </div>
        )}
      </div>
    </main>
  );
}
