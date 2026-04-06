"use client";

import { useState, useEffect, useMemo } from "react";
import { ChannelProvider, usePresenceListener } from "ably/react";
import { ConversationList } from "@/components/chat/conversation-list";
import { MessageRequestList } from "@/components/chat/message-request-list";
import { ChatFriendsList } from "@/components/chat/chat-friends-list";
import { MessageThread } from "@/components/chat/message-thread";
import { useAblyReady } from "@/app/providers";
import { getAblyRealtimeClient } from "@/lib/ably";
import { rpc } from "@/lib/rpc";
import type {
  ConversationListItem,
  MessageRequestData,
  MessageData,
  ConversationWithParticipants,
  ChatThemeColors,
  ChatUserProfile,
} from "@/types/chat";

const PRESENCE_CHANNEL = "presence:global";

interface ConversationPageClientProps {
  conversationId: string;
  conversations: ConversationListItem[];
  messageRequests: MessageRequestData[];
  friends?: ChatUserProfile[];
  initialMessages: MessageData[];
  conversation: ConversationWithParticipants;
  currentUserId: string;
  phoneVerified: boolean;
  isBlocked?: boolean;
  themeColors?: ChatThemeColors;
  hasCustomTheme?: boolean;
  themeStyle?: React.CSSProperties;
}

function PresenceAwareSidebar({
  conversations,
  activeId,
  messageRequests,
  friends,
  themeColors,
}: {
  conversations: ConversationListItem[];
  activeId: string;
  messageRequests: MessageRequestData[];
  friends?: ChatUserProfile[];
  themeColors?: ChatThemeColors;
}) {
  const { presenceData } = usePresenceListener(PRESENCE_CHANNEL);
  const onlineUserIds = useMemo(
    () => new Set(presenceData.map((m) => m.clientId)),
    [presenceData]
  );

  const existingConversationUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const conv of conversations) {
      if (!conv.isGroup) {
        for (const p of conv.participants) {
          ids.add(p.id);
        }
      }
    }
    return ids;
  }, [conversations]);

  const friendsWithoutConversation = useMemo(
    () => (friends ?? []).filter((f) => !existingConversationUserIds.has(f.id)),
    [friends, existingConversationUserIds]
  );

  return (
    <>
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        onlineUserIds={onlineUserIds}
        themeColors={themeColors}
      />
      {friendsWithoutConversation.length > 0 && (
        <ChatFriendsList friends={friendsWithoutConversation} onlineUserIds={onlineUserIds} />
      )}
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
  isBlocked,
  themeColors,
}: {
  conversationId: string;
  initialMessages: MessageData[];
  conversation: ConversationWithParticipants;
  currentUserId: string;
  phoneVerified: boolean;
  isBlocked?: boolean;
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
            isBlocked={isBlocked}
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
  friends,
  initialMessages,
  conversation,
  currentUserId,
  phoneVerified,
  isBlocked,
  themeColors,
  hasCustomTheme,
  themeStyle,
}: ConversationPageClientProps) {
  const ablyReady = useAblyReady();
  const [liveConversations, setLiveConversations] = useState(conversations);

  // Refresh sidebar on focus, periodically, and on real-time chat notifications
  useEffect(() => {
    const refresh = () => rpc<ConversationListItem[]>("getConversations").then(setLiveConversations);
    const handleFocus = () => refresh();
    window.addEventListener("focus", handleFocus);
    const interval = setInterval(refresh, 15000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, []);

  // Subscribe to chat-notify channel for instant conversation list updates
  useEffect(() => {
    if (!ablyReady || !currentUserId) return;
    const client = getAblyRealtimeClient();
    const channel = client.channels.get(`chat-notify:${currentUserId}`);
    const handler = () => {
      rpc<ConversationListItem[]>("getConversations").then(setLiveConversations);
    };
    channel.subscribe("new", handler);
    return () => {
      channel.unsubscribe("new", handler);
    };
  }, [ablyReady, currentUserId]);

  return (
    <main
      className={`mx-auto flex h-[calc(100dvh-120px)] max-w-5xl px-2 py-2 md:h-[calc(100dvh-57px)] md:px-4 md:py-6 ${hasCustomTheme ? "chat-themed" : ""}`}
      style={themeStyle}
    >
      {/* Sidebar */}
      <div className="hidden flex-col overflow-hidden rounded-l-2xl border border-zinc-200 bg-white md:flex md:w-80 md:flex-shrink-0 dark:border-zinc-800 dark:bg-zinc-900">
        {ablyReady ? (
          <PresenceAwareSidebar
            conversations={liveConversations}
            activeId={conversationId}
            messageRequests={messageRequests}
            friends={friends}
            themeColors={themeColors}
          />
        ) : (
          <>
            <ConversationList
              conversations={liveConversations}
              activeId={conversationId}
              themeColors={themeColors}
            />
            {friends && friends.length > 0 && <ChatFriendsList friends={friends} />}
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
            isBlocked={isBlocked}
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
