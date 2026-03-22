"use client";

import { useState, useEffect, useMemo } from "react";
import { usePresenceListener } from "ably/react";
import { useSession } from "next-auth/react";
import { ConversationList } from "@/components/chat/conversation-list";
import { MessageRequestList } from "@/components/chat/message-request-list";
import { ChatFriendsList } from "@/components/chat/chat-friends-list";
import { useAblyReady } from "@/app/providers";
import { getAblyRealtimeClient } from "@/lib/ably";
import { getConversations } from "@/app/chat/actions";
import type { ConversationListItem, MessageRequestData, ChatThemeColors, ChatUserProfile } from "@/types/chat";

const PRESENCE_CHANNEL = "presence:global";

interface ChatPageClientProps {
  conversations: ConversationListItem[];
  messageRequests: MessageRequestData[];
  friends?: ChatUserProfile[];
  themeColors?: ChatThemeColors;
  hasCustomTheme?: boolean;
  themeStyle?: React.CSSProperties;
}

function PresenceAwareSidebar({
  conversations,
  messageRequests,
  friends,
  themeColors,
}: {
  conversations: ConversationListItem[];
  messageRequests: MessageRequestData[];
  friends?: ChatUserProfile[];
  themeColors?: ChatThemeColors;
}) {
  const { presenceData } = usePresenceListener(PRESENCE_CHANNEL);
  const onlineUserIds = useMemo(
    () => new Set(presenceData.map((m) => m.clientId)),
    [presenceData]
  );

  // Filter out friends who already have conversations
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

export function ChatPageClient({
  conversations,
  messageRequests,
  friends,
  themeColors,
  hasCustomTheme,
  themeStyle,
}: ChatPageClientProps) {
  const ablyReady = useAblyReady();
  const { data: session } = useSession();
  const [liveConversations, setLiveConversations] = useState(conversations);

  // Subscribe to chat-notify channel for instant conversation list updates
  useEffect(() => {
    if (!ablyReady || !session?.user?.id) return;
    const client = getAblyRealtimeClient();
    const channel = client.channels.get(`chat-notify:${session.user.id}`);
    const handler = () => {
      getConversations().then(setLiveConversations);
    };
    channel.subscribe("new", handler);
    return () => {
      channel.unsubscribe("new", handler);
    };
  }, [ablyReady, session?.user?.id]);

  return (
    <main
      className={`mx-auto flex h-[calc(100dvh-120px)] max-w-5xl px-2 py-2 md:h-[calc(100dvh-57px)] md:px-4 md:py-6 ${hasCustomTheme ? "chat-themed" : ""}`}
      style={themeStyle}
    >
      {/* Sidebar */}
      <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white md:w-80 md:flex-shrink-0 md:rounded-l-2xl md:rounded-r-none dark:border-zinc-800 dark:bg-zinc-900">
        {ablyReady ? (
          <PresenceAwareSidebar
            conversations={liveConversations}
            messageRequests={messageRequests}
            friends={friends}
            themeColors={themeColors}
          />
        ) : (
          <>
            <ConversationList conversations={liveConversations} themeColors={themeColors} />
            {friends && friends.length > 0 && <ChatFriendsList friends={friends} />}
            <MessageRequestList requests={messageRequests} />
          </>
        )}
      </div>

      {/* Empty state */}
      <div className="hidden items-center justify-center rounded-r-2xl border border-l-0 border-zinc-200 bg-white md:flex md:flex-1 dark:border-zinc-800 dark:bg-zinc-900">
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
