"use client";

import { useState, useEffect, useMemo } from "react";
import { ChannelProvider, usePresenceListener } from "ably/react";
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
  ChatThemeColors,
} from "@/types/chat";

const PRESENCE_CHANNEL = "presence:global";

interface ConversationPageClientProps {
  conversationId: string;
  conversations: ConversationListItem[];
  messageRequests: MessageRequestData[];
  initialMessages: MessageData[];
  conversation: ConversationWithParticipants;
  currentUserId: string;
  phoneVerified: boolean;
  themeColors?: ChatThemeColors;
}

function PresenceAwareSidebar({
  conversations,
  activeId,
  messageRequests,
  themeColors,
}: {
  conversations: ConversationListItem[];
  activeId: string;
  messageRequests: MessageRequestData[];
  themeColors?: ChatThemeColors;
}) {
  const { presenceData } = usePresenceListener(PRESENCE_CHANNEL);
  const onlineUserIds = useMemo(
    () => new Set(presenceData.map((m) => m.clientId)),
    [presenceData]
  );

  return (
    <>
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        onlineUserIds={onlineUserIds}
        themeColors={themeColors}
      />
      <MessageRequestList requests={messageRequests} />
    </>
  );
}

function PresenceAwareThread({
  conversationId,
  initialMessages,
  conversation,
  currentUserId,
  phoneVerified,
  themeColors,
}: {
  conversationId: string;
  initialMessages: MessageData[];
  conversation: ConversationWithParticipants;
  currentUserId: string;
  phoneVerified: boolean;
  themeColors?: ChatThemeColors;
}) {
  const { presenceData } = usePresenceListener(PRESENCE_CHANNEL);
  const onlineUserIds = useMemo(
    () => new Set(presenceData.map((m) => m.clientId)),
    [presenceData]
  );

  return (
    <ChannelProvider channelName={`chat:${conversationId}`}>
      <ChannelProvider channelName={`typing:${conversationId}`}>
        <ChannelProvider channelName={`read:${conversationId}`}>
          <MessageThread
            conversationId={conversationId}
            initialMessages={initialMessages}
            conversation={conversation}
            currentUserId={currentUserId}
            onlineUserIds={onlineUserIds}
            phoneVerified={phoneVerified}
            themeColors={themeColors}
          />
        </ChannelProvider>
      </ChannelProvider>
    </ChannelProvider>
  );
}

export function ConversationPageClient({
  conversationId,
  conversations,
  messageRequests,
  initialMessages,
  conversation,
  currentUserId,
  phoneVerified,
  themeColors,
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
      className="mx-auto flex max-w-5xl px-2 py-2 md:px-4 md:py-6"
      style={{ height: "calc(100vh - 57px)" }}
    >
      {/* Sidebar */}
      <div className="hidden flex-col overflow-hidden rounded-l-2xl border border-zinc-200 bg-white md:flex md:w-80 md:flex-shrink-0 dark:border-zinc-800 dark:bg-zinc-900">
        {ablyReady ? (
          <PresenceAwareSidebar
            conversations={liveConversations}
            activeId={conversationId}
            messageRequests={messageRequests}
            themeColors={themeColors}
          />
        ) : (
          <>
            <ConversationList
              conversations={liveConversations}
              activeId={conversationId}
              themeColors={themeColors}
            />
            <MessageRequestList requests={messageRequests} />
          </>
        )}
      </div>

      {/* Message thread */}
      <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white md:w-auto md:flex-1 md:rounded-l-none md:rounded-r-2xl md:border-l-0 dark:border-zinc-800 dark:bg-zinc-900">
        {ablyReady ? (
          <PresenceAwareThread
            conversationId={conversationId}
            initialMessages={initialMessages}
            conversation={conversation}
            currentUserId={currentUserId}
            phoneVerified={phoneVerified}
            themeColors={themeColors}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-zinc-400">Connecting...</p>
          </div>
        )}
      </div>
    </main>
  );
}
