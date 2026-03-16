"use client";

import Link from "next/link";
import { timeAgo } from "@/lib/time";
import { PresenceIndicator } from "./presence-indicator";
import { FramedAvatar } from "@/components/framed-avatar";
import type { ConversationListItem, ChatThemeColors } from "@/types/chat";

interface ConversationItemProps {
  conversation: ConversationListItem;
  isActive: boolean;
  isOnline?: boolean;
  themeColors?: ChatThemeColors;
}

export function ConversationItem({
  conversation,
  isActive,
  isOnline = false,
  themeColors,
}: ConversationItemProps) {
  const { participants, lastMessage, unreadCount, isGroup, name } = conversation;

  const displayName = isGroup
    ? name ?? "Group"
    : participants[0]?.displayName ??
      participants[0]?.username ??
      participants[0]?.name ??
      "User";

  const avatar = isGroup
    ? conversation.avatarUrl
    : participants[0]?.avatar ?? participants[0]?.image;

  const hasThemedActive = isActive && themeColors?.containerColor;

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
        isActive && !hasThemedActive
          ? "bg-zinc-100 dark:bg-zinc-800"
          : ""
      }`}
      style={hasThemedActive ? { backgroundColor: "color-mix(in srgb, var(--chat-active-bg) 20%, transparent)", color: "var(--chat-active-text)" } : undefined}
    >
      <div className="relative flex-shrink-0">
        <FramedAvatar
          src={avatar}
          alt={displayName}
          initial={isGroup ? "#" : displayName[0]?.toUpperCase()}
          size={56}
          frameId={isGroup ? null : participants[0]?.profileFrameId}
        />
        {!isGroup && (
          <span className="absolute -bottom-0.5 -right-0.5">
            <PresenceIndicator isOnline={isOnline} size="sm" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={`truncate text-sm ${unreadCount > 0 ? "font-semibold text-zinc-900 dark:text-zinc-100" : "font-medium text-zinc-700 dark:text-zinc-300"}`}>
            {displayName}
          </span>
          {lastMessage && (
            <span className="ml-2 flex-shrink-0 text-[10px] text-zinc-400">
              {timeAgo(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className={`truncate text-xs ${unreadCount > 0 ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-500 dark:text-zinc-400"}`}>
            {lastMessage
              ? lastMessage.content
                || (lastMessage.mediaType === "image" ? "Sent a photo"
                  : lastMessage.mediaType === "video" ? "Sent a video"
                  : lastMessage.mediaType === "audio" ? "Voice message"
                  : lastMessage.mediaType === "document" ? "Sent a file"
                  : "No messages yet")
              : "No messages yet"}
          </p>
          {unreadCount > 0 && (
            <span className="ml-2 flex h-4.5 min-w-4.5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-medium text-white">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
