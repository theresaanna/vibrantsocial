"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useChannel } from "ably/react";
import Link from "next/link";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { TypingIndicator } from "./typing-indicator";
import { PresenceIndicator } from "./presence-indicator";
import { GroupChatSettings } from "./group-chat-settings";
import { useChatMessages } from "@/hooks/use-chat-messages";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { useReadReceipts } from "@/hooks/use-read-receipts";
import {
  sendMessage,
  editMessage,
  deleteMessage,
  markConversationRead,
  getMessages,
} from "@/app/chat/actions";
import type {
  MessageData,
  ConversationWithParticipants,
  ChatUserProfile,
} from "@/types/chat";

interface MessageThreadProps {
  conversationId: string;
  initialMessages: MessageData[];
  conversation: ConversationWithParticipants;
  currentUserId: string;
  onlineUserIds?: Set<string>;
  phoneVerified?: boolean;
}

export function MessageThread({
  conversationId,
  initialMessages,
  conversation,
  currentUserId,
  onlineUserIds = new Set(),
  phoneVerified = true,
}: MessageThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50);

  const { messages, setMessages, channelName } = useChatMessages(
    conversationId,
    initialMessages
  );
  const { typingUsers, keystroke, stopTyping } = useTypingIndicator(
    conversationId,
    currentUserId
  );
  const { readTimestamps } = useReadReceipts(conversationId);

  // Build participant lookup map
  const participantMap = useMemo(() => {
    const map = new Map<string, ChatUserProfile>();
    conversation.participants.forEach((p) => {
      map.set(p.userId, p.user);
    });
    return map;
  }, [conversation.participants]);

  // Build read status map for own messages
  const participantReadTimes = useMemo(() => {
    const map = new Map<string, Date>();
    conversation.participants.forEach((p) => {
      if (p.userId !== currentUserId && p.lastReadAt) {
        map.set(p.userId, p.lastReadAt);
      }
    });
    // Merge real-time updates
    readTimestamps.forEach((ts, userId) => {
      if (userId !== currentUserId) {
        const existing = map.get(userId);
        if (!existing || ts > existing) {
          map.set(userId, ts);
        }
      }
    });
    return map;
  }, [conversation.participants, readTimestamps, currentUserId]);

  // Determine display info
  const isGroup = conversation.isGroup;
  const otherParticipants = conversation.participants.filter(
    (p) => p.userId !== currentUserId
  );
  const displayName = isGroup
    ? conversation.name ?? "Group"
    : otherParticipants[0]?.user.displayName ??
      otherParticipants[0]?.user.username ??
      otherParticipants[0]?.user.name ??
      "User";
  const otherUserId = !isGroup ? otherParticipants[0]?.userId : undefined;
  const isOtherOnline = otherUserId ? onlineUserIds.has(otherUserId) : false;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark conversation as read when opened (server publishes to Ably)
  useEffect(() => {
    markConversationRead(conversationId);
  }, [conversationId]);

  // Load older messages on scroll to top
  const handleScroll = useCallback(async () => {
    const container = scrollContainerRef.current;
    if (!container || loadingMore || !hasMore) return;
    if (container.scrollTop > 50) return;

    setLoadingMore(true);
    const oldestMessage = messages[0];
    if (!oldestMessage) {
      setLoadingMore(false);
      return;
    }

    const result = await getMessages(conversationId, oldestMessage.id);
    if (result.messages.length > 0) {
      setMessages((prev) => [...result.messages, ...prev]);
    }
    setHasMore(result.nextCursor !== null);
    setLoadingMore(false);
  }, [conversationId, messages, loadingMore, hasMore, setMessages]);

  // Get read status for a message
  const getReadStatus = (msg: MessageData): "sent" | "delivered" | "read" => {
    if (msg.senderId !== currentUserId) return "sent";
    let anyRead = false;
    participantReadTimes.forEach((readAt) => {
      if (readAt >= msg.createdAt) anyRead = true;
    });
    return anyRead ? "read" : "delivered";
  };

  const handleSendMessage = async (content: string) => {
    const result = await sendMessage({ conversationId, content });
    if (!result.success) return;

    // The message will arrive via Ably subscription
    // But we can also optimistically add it
    const newMsg: MessageData = {
      id: result.messageId!,
      conversationId,
      senderId: currentUserId,
      content,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: participantMap.get(currentUserId) ?? {
        id: currentUserId,
        username: null,
        displayName: null,
        name: null,
        avatar: null,
        image: null,
      },
    };
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    await editMessage({ messageId, content });
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, content, editedAt: new Date() } : m
      )
    );
  };

  const handleDeleteMessage = async (messageId: string) => {
    await deleteMessage(messageId);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, deletedAt: new Date() } : m
      )
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 md:hidden dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Back to conversations"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </Link>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {displayName}
            </h3>
            {!isGroup && (
              <div className="flex items-center gap-1.5">
                <PresenceIndicator isOnline={isOtherOnline} size="sm" />
                <span className="text-xs text-zinc-500">
                  {isOtherOnline ? "Online" : "Offline"}
                </span>
              </div>
            )}
            {isGroup && (
              <span className="text-xs text-zinc-500">
                {conversation.participants.length} members
              </span>
            )}
          </div>
        </div>
        {isGroup && (
          <button
            onClick={() => setShowGroupSettings(true)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Group settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.992 6.992 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-4"
      >
        {loadingMore && (
          <p className="py-2 text-center text-xs text-zinc-400">
            Loading older messages...
          </p>
        )}
        {messages.map((msg) => {
          const senderProfile = participantMap.get(msg.senderId) ?? msg.sender;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.senderId === currentUserId}
              senderProfile={senderProfile}
              isGroup={isGroup}
              readStatus={getReadStatus(msg)}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      <TypingIndicator
        typingUserIds={typingUsers}
        participants={participantMap}
        currentUserId={currentUserId}
      />

      {/* Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onKeystroke={keystroke}
        onStopTyping={stopTyping}
        phoneVerified={phoneVerified}
      />

      {/* Group settings modal */}
      {showGroupSettings && (
        <GroupChatSettings
          conversation={conversation}
          currentUserId={currentUserId}
          onClose={() => setShowGroupSettings(false)}
        />
      )}
    </div>
  );
}
