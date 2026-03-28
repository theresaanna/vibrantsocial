"use client";

import { useEffect, useRef, useState, useMemo, useCallback, useActionState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useChannel } from "ably/react";
import Link from "next/link";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { TypingIndicator } from "./typing-indicator";
import { PresenceIndicator } from "./presence-indicator";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import { GroupChatSettings } from "./group-chat-settings";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReportModal } from "@/components/report-modal";
import { toggleBlock } from "@/app/feed/block-actions";
import { useChatMessages } from "@/hooks/use-chat-messages";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { useReadReceipts } from "@/hooks/use-read-receipts";
import {
  sendMessage,
  editMessage,
  deleteMessage,
  markConversationRead,
  getMessages,
  toggleReaction,
  leaveConversation,
} from "@/app/chat/actions";
import type {
  MessageData,
  MediaType,
  ConversationWithParticipants,
  ChatUserProfile,
  ChatThemeColors,
} from "@/types/chat";
import type { MediaAttachment } from "./message-input";

interface MessageThreadProps {
  conversationId: string;
  initialMessages: MessageData[];
  conversation: ConversationWithParticipants;
  currentUserId: string;
  onlineUserIds?: Set<string>;
  phoneVerified?: boolean;
  isBlocked?: boolean;
  themeColors?: ChatThemeColors;
}

export function MessageThread({
  conversationId,
  initialMessages,
  conversation,
  currentUserId,
  onlineUserIds = new Set(),
  phoneVerified = true,
  isBlocked: initialIsBlocked = false,
  themeColors,
}: MessageThreadProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isBlocked, setIsBlocked] = useState(initialIsBlocked);
  const menuRef = useRef<HTMLDivElement>(null);

  const { messages, setMessages, channelName } = useChatMessages(
    conversationId,
    initialMessages,
    currentUserId
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
  const otherUser = !isGroup ? otherParticipants[0]?.user : undefined;
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

  // Get list of users who have seen a specific message (group chats only)
  const getSeenBy = useCallback(
    (msg: MessageData): ChatUserProfile[] => {
      if (msg.senderId !== currentUserId || !isGroup) return [];
      const seenUsers: ChatUserProfile[] = [];
      participantReadTimes.forEach((readAt, userId) => {
        if (readAt >= msg.createdAt) {
          const profile = participantMap.get(userId);
          if (profile) seenUsers.push(profile);
        }
      });
      return seenUsers;
    },
    [currentUserId, isGroup, participantReadTimes, participantMap]
  );

  // Get read status for a message
  const getReadStatus = (msg: MessageData): "sent" | "delivered" | "read" => {
    if (msg.senderId !== currentUserId) return "sent";
    let anyRead = false;
    participantReadTimes.forEach((readAt) => {
      if (readAt >= msg.createdAt) anyRead = true;
    });
    return anyRead ? "read" : "delivered";
  };

  const handleSendMessage = async (content: string, media?: MediaAttachment[]) => {
    const currentReply = replyingTo;
    setReplyingTo(null); // Clear reply state immediately for responsiveness

    // Build reply-to data for optimistic update
    const senderProfile = participantMap.get(currentUserId);
    const replyToForOptimistic = currentReply
      ? {
          id: currentReply.id,
          content: currentReply.content,
          senderId: currentReply.senderId,
          senderName:
            currentReply.sender.displayName ??
            currentReply.sender.username ??
            currentReply.sender.name ??
            "User",
          mediaType: currentReply.mediaType,
          deletedAt: currentReply.deletedAt,
        }
      : null;

    // Send one message per media attachment (DB schema stores one media per message)
    // Text content goes on the first message only
    const items = media && media.length > 0 ? media : [undefined];
    for (let i = 0; i < items.length; i++) {
      const attachment = items[i];
      const msgContent = i === 0 ? content : "";

      const result = await sendMessage({
        conversationId,
        content: msgContent,
        ...(attachment && {
          mediaUrl: attachment.url,
          mediaType: attachment.type,
          mediaFileName: attachment.fileName,
          mediaFileSize: attachment.fileSize,
        }),
        // Reply only on the first message
        ...(i === 0 && currentReply && { replyToId: currentReply.id }),
      });
      if (!result.success) return;

      const newMsg: MessageData = {
        id: result.messageId!,
        conversationId,
        senderId: currentUserId,
        content: msgContent,
        mediaUrl: attachment?.url ?? null,
        mediaType: (attachment?.type as MediaType) ?? null,
        mediaFileName: attachment?.fileName ?? null,
        mediaFileSize: attachment?.fileSize ?? null,
        isNsfw: false,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date(),
        reactions: [],
        replyTo: i === 0 ? replyToForOptimistic : null,
        sender: senderProfile ?? {
          id: currentUserId,
          username: null,
          displayName: null,
          name: null,
          avatar: null,
          image: null,
          profileFrameId: null,
        },
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    }
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

  const handleReaction = async (messageId: string, emoji: string) => {
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = [...m.reactions];
        const group = reactions.find((r) => r.emoji === emoji);
        if (group) {
          if (group.userIds.includes(currentUserId)) {
            group.userIds = group.userIds.filter((id) => id !== currentUserId);
            if (group.userIds.length === 0) {
              return { ...m, reactions: reactions.filter((r) => r.emoji !== emoji) };
            }
          } else {
            group.userIds = [...group.userIds, currentUserId];
          }
          return { ...m, reactions: [...reactions] };
        }
        return { ...m, reactions: [...reactions, { emoji, userIds: [currentUserId] }] };
      })
    );
    await toggleReaction({ messageId, emoji });
  };

  // Find last own message for up-arrow edit
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const handleEditLastMessage = useCallback(() => {
    const lastOwn = [...messages]
      .reverse()
      .find((m) => m.senderId === currentUserId && !m.deletedAt);
    if (lastOwn) {
      setEditingMessageId(lastOwn.id);
    }
  }, [messages, currentUserId]);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<MessageData | null>(null);

  const handleReply = useCallback((msg: MessageData) => {
    setReplyingTo(msg);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  // Scroll to a specific message (used when clicking reply quotes)
  const handleScrollToMessage = useCallback((messageId: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Brief highlight effect
      el.classList.add("bg-blue-50", "dark:bg-blue-900/20");
      setTimeout(() => {
        el.classList.remove("bg-blue-50", "dark:bg-blue-900/20");
      }, 1500);
    }
  }, []);

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  // Block handler (for 1:1 chats)
  const [, blockFormAction] = useActionState(toggleBlock, {
    success: false,
    message: "",
  });

  const handleBlockConfirm = () => {
    setShowBlockConfirm(false);
    if (!otherUserId) return;
    const formData = new FormData();
    formData.append("userId", otherUserId);
    blockFormAction(formData);
    setIsBlocked((prev) => !prev);
  };

  // Delete (leave) conversation handler
  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    await leaveConversation(conversationId);
    router.push("/chat");
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
          {!isGroup && otherUser && (
            <Link href={`/${otherUser.username}`} className="shrink-0">
              <FramedAvatar
                src={otherUser.avatar ?? otherUser.image}
                alt={displayName}
                initial={displayName.charAt(0)}
                size={36}
                frameId={otherUser.profileFrameId}
              />
            </Link>
          )}
          <div>
            {!isGroup && otherUser?.username ? (
              <Link href={`/${otherUser.username}`} className="hover:underline">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <StyledName fontId={otherUser.usernameFont}>{displayName}</StyledName>
                </h3>
              </Link>
            ) : (
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {displayName}
              </h3>
            )}
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
        <div className="flex items-center gap-1">
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
          {/* Three-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu((prev) => !prev)}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label="Chat options"
              data-testid="chat-options-button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                <button
                  onClick={() => { setShowMenu(false); setShowReportModal(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  data-testid="chat-report-button"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
                  </svg>
                  Report
                </button>
                {!isGroup && otherUserId && (
                  <button
                    onClick={() => { setShowMenu(false); setShowBlockConfirm(true); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-zinc-50 dark:text-red-400 dark:hover:bg-zinc-700"
                    data-testid="chat-block-button"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    {isBlocked ? "Unblock" : "Block"}
                  </button>
                )}
                <button
                  onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-zinc-50 dark:text-red-400 dark:hover:bg-zinc-700"
                  data-testid="chat-delete-button"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  Delete chat
                </button>
              </div>
            )}
          </div>
        </div>
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
            <div key={msg.id} data-message-id={msg.id} className="transition-colors duration-500">
              <MessageBubble
                message={msg}
                isOwn={msg.senderId === currentUserId}
                senderProfile={senderProfile}
                isGroup={isGroup}
                readStatus={getReadStatus(msg)}
                seenBy={getSeenBy(msg)}
                onEdit={handleEditMessage}
                onDelete={handleDeleteMessage}
                onReaction={handleReaction}
                onReply={handleReply}
                onScrollToMessage={handleScrollToMessage}
                currentUserId={currentUserId}
                isEditing={editingMessageId === msg.id}
                onEditingChange={(editing) =>
                  setEditingMessageId(editing ? msg.id : null)
                }
                themeColors={themeColors}
              />
            </div>
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
        blockedMessage={isBlocked ? "You cannot send messages in this conversation." : undefined}
        onEditLastMessage={handleEditLastMessage}
        replyingTo={replyingTo}
        onCancelReply={handleCancelReply}
        hasCustomTheme={!!themeColors?.bgColor}
      />

      {/* Group settings modal */}
      {showGroupSettings && (
        <GroupChatSettings
          conversation={conversation}
          currentUserId={currentUserId}
          onClose={() => setShowGroupSettings(false)}
          onConversationUpdate={() => router.refresh()}
        />
      )}

      {/* Report modal */}
      <ReportModal
        contentType="conversation"
        contentId={conversationId}
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />

      {/* Block confirmation */}
      <ConfirmDialog
        open={showBlockConfirm}
        title={isBlocked ? "Unblock?" : "Block?"}
        message={
          isBlocked
            ? "Are you sure you want to unblock this user? They will be able to message you again."
            : "Are you sure you want to block this user? You won't be able to send or receive messages from them. Existing follows and friend connections will be removed."
        }
        confirmLabel={isBlocked ? "Unblock" : "Block"}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleBlockConfirm}
        onCancel={() => setShowBlockConfirm(false)}
      />

      {/* Delete chat confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete chat?"
        message="This will remove the conversation from your chat list. Other participants will still have access to it."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
