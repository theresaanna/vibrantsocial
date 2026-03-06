"use client";

import { useState } from "react";
import { timeAgo } from "@/lib/time";
import { ReadReceiptIndicator } from "./read-receipt-indicator";
import type { MessageData, ChatUserProfile } from "@/types/chat";

interface MessageBubbleProps {
  message: MessageData;
  isOwn: boolean;
  senderProfile: ChatUserProfile;
  isGroup: boolean;
  readStatus: "sent" | "delivered" | "read";
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
}

export function MessageBubble({
  message,
  isOwn,
  senderProfile,
  isGroup,
  readStatus,
  onEdit,
  onDelete,
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showMenu, setShowMenu] = useState(false);

  if (message.deletedAt) {
    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} px-4 py-0.5`}>
        <div className="rounded-2xl bg-zinc-100 px-4 py-2 italic text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
          This message was deleted
        </div>
      </div>
    );
  }

  const handleEditSubmit = () => {
    const trimmed = editContent.trim();
    if (trimmed && trimmed !== message.content && onEdit) {
      onEdit(message.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    }
    if (e.key === "Escape") {
      setEditContent(message.content);
      setIsEditing(false);
    }
  };

  const avatar = senderProfile.avatar ?? senderProfile.image;
  const displayName =
    senderProfile.displayName ?? senderProfile.username ?? senderProfile.name ?? "User";

  return (
    <div
      className={`group flex ${isOwn ? "justify-end" : "justify-start"} px-4 py-0.5`}
      onMouseLeave={() => setShowMenu(false)}
    >
      <div className={`flex max-w-[70%] gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
        {/* Avatar for group non-own messages */}
        {isGroup && !isOwn && (
          <div className="mt-auto flex-shrink-0">
            {avatar ? (
              <img
                src={avatar}
                alt={displayName}
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>
        )}

        <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
          {/* Sender name in group */}
          {isGroup && !isOwn && (
            <span className="mb-0.5 px-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {displayName}
            </span>
          )}

          {/* Message content */}
          <div className="relative">
            {isEditing ? (
              <div className="flex flex-col gap-1">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="min-w-[200px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-1 text-xs">
                  <button
                    onClick={handleEditSubmit}
                    className="rounded px-2 py-0.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-zinc-800"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditContent(message.content);
                      setIsEditing(false);
                    }}
                    className="rounded px-2 py-0.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`rounded-2xl px-3.5 py-2 text-sm ${
                  isOwn
                    ? "rounded-br-sm bg-blue-500 text-white"
                    : "rounded-bl-sm bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            )}

            {/* Context menu for own messages */}
            {isOwn && !isEditing && (
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                  aria-label="Message options"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                  </svg>
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setShowMenu(false);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        onDelete?.(message.id);
                        setShowMenu(false);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-zinc-700"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Metadata row */}
          <div className={`flex items-center gap-1.5 px-1 pt-0.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
            <span className="text-[10px] text-zinc-400">
              {timeAgo(message.createdAt)}
            </span>
            {message.editedAt && (
              <span className="text-[10px] text-zinc-400">(edited)</span>
            )}
            {isOwn && <ReadReceiptIndicator status={readStatus} />}
          </div>
        </div>
      </div>
    </div>
  );
}
