"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePathname } from "next/navigation";
import { usePresenceListener } from "ably/react";
import Link from "next/link";
import { getConversations } from "@/app/chat/actions";
import { useAblyReady } from "@/app/providers";
import { PresenceIndicator } from "@/components/chat/presence-indicator";
import { timeAgo } from "@/lib/time";
import type { ConversationListItem } from "@/types/chat";

const PRESENCE_CHANNEL = "presence:global";
const MAX_VISIBLE = 8;

function PresenceAwareList({
  conversations,
  onClose,
}: {
  conversations: ConversationListItem[];
  onClose: () => void;
}) {
  const { presenceData } = usePresenceListener(PRESENCE_CHANNEL);
  const onlineUserIds = useMemo(
    () => new Set(presenceData.map((m) => m.clientId)),
    [presenceData]
  );

  return (
    <>
      {conversations.map((conv) => (
        <ChatPaneItem
          key={conv.id}
          conversation={conv}
          onlineUserIds={onlineUserIds}
          onClose={onClose}
        />
      ))}
    </>
  );
}

interface ChatNavProps {
  initialConversations: ConversationListItem[];
}

export function ChatNav({ initialConversations }: ChatNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] =
    useState<ConversationListItem[]>(initialConversations);
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const ablyReady = useAblyReady();

  const totalUnread = conversations.reduce(
    (sum, c) => sum + c.unreadCount,
    0
  );

  // Close pane on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Refresh conversations when pane opens
  useEffect(() => {
    if (isOpen) {
      getConversations().then(setConversations);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  const recent = conversations.slice(0, MAX_VISIBLE);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Chat
        {totalUnread > 0 && (
          <span className="absolute -right-3.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-medium text-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Slide-out pane */}
      <div
        className={`absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 ${
          isOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Recent Chats
          </h3>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {recent.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">
              No conversations yet
            </div>
          ) : ablyReady ? (
            <PresenceAwareList
              conversations={recent}
              onClose={() => setIsOpen(false)}
            />
          ) : (
            recent.map((conv) => (
              <ChatPaneItem
                key={conv.id}
                conversation={conv}
                onlineUserIds={new Set()}
                onClose={() => setIsOpen(false)}
              />
            ))
          )}
        </div>

        <Link
          href="/chat"
          onClick={() => setIsOpen(false)}
          className="block border-t border-zinc-100 px-4 py-2.5 text-center text-xs font-medium text-blue-500 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
        >
          View all chats
        </Link>
      </div>
    </div>
  );
}

function ChatPaneItem({
  conversation,
  onlineUserIds,
  onClose,
}: {
  conversation: ConversationListItem;
  onlineUserIds: Set<string>;
  onClose: () => void;
}) {
  const { participants, lastMessage, unreadCount, isGroup, name } =
    conversation;

  const displayName = isGroup
    ? name ?? "Group"
    : participants[0]?.displayName ??
      participants[0]?.username ??
      participants[0]?.name ??
      "User";

  const avatar = isGroup
    ? conversation.avatarUrl
    : participants[0]?.avatar ?? participants[0]?.image;

  const isOnline =
    !isGroup && participants[0] ? onlineUserIds.has(participants[0].id) : false;

  return (
    <Link
      href={`/chat/${conversation.id}`}
      onClick={onClose}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
    >
      <div className="relative flex-shrink-0">
        {avatar ? (
          <img
            src={avatar}
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {isGroup ? "#" : displayName[0]?.toUpperCase()}
          </div>
        )}
        {!isGroup && (
          <span className="absolute -bottom-0.5 -right-0.5">
            <PresenceIndicator isOnline={isOnline} size="sm" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span
            className={`truncate text-sm ${
              unreadCount > 0
                ? "font-semibold text-zinc-900 dark:text-zinc-100"
                : "font-medium text-zinc-700 dark:text-zinc-300"
            }`}
          >
            {displayName}
          </span>
          {lastMessage && (
            <span className="ml-2 flex-shrink-0 text-[10px] text-zinc-400">
              {timeAgo(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p
            className={`truncate text-xs ${
              unreadCount > 0
                ? "text-zinc-700 dark:text-zinc-300"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {lastMessage?.content ?? "No messages yet"}
          </p>
          {unreadCount > 0 && (
            <span className="ml-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
          )}
        </div>
      </div>
    </Link>
  );
}
