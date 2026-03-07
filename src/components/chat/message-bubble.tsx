"use client";

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { timeAgo } from "@/lib/time";
import { ReadReceiptIndicator } from "./read-receipt-indicator";
import { SeenByIndicator } from "./seen-by-indicator";
import { MediaRenderer } from "./media-renderer";
import type { MessageData, ChatUserProfile, MediaType } from "@/types/chat";

const LazyEmojiPicker = lazy(() => import("emoji-picker-react"));

interface MessageBubbleProps {
  message: MessageData;
  isOwn: boolean;
  senderProfile: ChatUserProfile;
  isGroup: boolean;
  readStatus: "sent" | "delivered" | "read";
  seenBy?: ChatUserProfile[];
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  currentUserId?: string;
  isEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

export function MessageBubble({
  message,
  isOwn,
  senderProfile,
  isGroup,
  readStatus,
  seenBy,
  onEdit,
  onDelete,
  onReaction,
  currentUserId,
  isEditing: externalIsEditing,
  onEditingChange,
}: MessageBubbleProps) {
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const isEditing = externalIsEditing ?? internalIsEditing;
  const setIsEditing = (val: boolean) => {
    setInternalIsEditing(val);
    onEditingChange?.(val);
  };

  const [editContent, setEditContent] = useState(message.content);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // When externally triggered to edit (e.g., up-arrow), reset content
  useEffect(() => {
    if (externalIsEditing) {
      setEditContent(message.content);
    }
  }, [externalIsEditing, message.content]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    function handleClick(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker]);

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

  const reactions = message.reactions ?? [];

  return (
    <div
      className={`group flex ${isOwn ? "justify-end" : "justify-start"} px-4 py-0.5`}
      onMouseLeave={() => {
        setShowMenu(false);
      }}
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
                {message.mediaUrl && message.mediaType && (
                  <div className="mb-1">
                    <MediaRenderer
                      mediaUrl={message.mediaUrl}
                      mediaType={message.mediaType as MediaType}
                      mediaFileName={message.mediaFileName}
                      mediaFileSize={message.mediaFileSize}
                      isOwn={isOwn}
                    />
                  </div>
                )}
                {message.content && (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
              </div>
            )}

            {/* Action buttons: context menu + emoji reaction trigger */}
            {!isEditing && (
              <div
                className={`absolute top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 ${
                  isOwn ? "-left-16 flex flex-row" : "-right-16 flex flex-row-reverse"
                }`}
              >
                {/* Emoji reaction button */}
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                    aria-label="Add reaction"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.536-4.464a.75.75 0 10-1.06-1.06 3.5 3.5 0 01-4.95 0 .75.75 0 00-1.06 1.06 5 5 0 007.07 0zM9 8.5c0 .828-.448 1.5-1 1.5s-1-.672-1-1.5S7.448 7 8 7s1 .672 1 1.5zm3 1.5c.552 0 1-.672 1-1.5S12.552 7 12 7s-1 .672-1 1.5.448 1.5 1 1.5z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {showEmojiPicker && (
                    <div
                      className={`absolute z-50 mt-1 ${
                        isOwn ? "right-0 top-full" : "left-0 top-full"
                      }`}
                      data-testid="emoji-picker"
                    >
                      <Suspense
                        fallback={
                          <div className="flex h-[350px] w-[350px] items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-400 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                            Loading...
                          </div>
                        }
                      >
                        <LazyEmojiPicker
                          onEmojiClick={(emojiData) => {
                            onReaction?.(message.id, emojiData.emoji);
                            setShowEmojiPicker(false);
                          }}
                          width={350}
                          height={400}
                          searchPlaceholder="Search emoji..."
                          previewConfig={{ showPreview: false }}
                        />
                      </Suspense>
                    </div>
                  )}
                </div>

                {/* Context menu for own messages */}
                {isOwn && (
                  <div className="relative">
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
                        {!message.mediaUrl && (
                          <button
                            onClick={() => {
                              setIsEditing(true);
                              setShowMenu(false);
                            }}
                            className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            Edit
                          </button>
                        )}
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
            )}
          </div>

          {/* Reactions display */}
          {reactions.length > 0 && (
            <div className={`flex flex-wrap gap-1 px-1 pt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
              {reactions.map((reaction) => {
                const isReacted = currentUserId ? reaction.userIds.includes(currentUserId) : false;
                return (
                  <button
                    key={reaction.emoji}
                    onClick={() => onReaction?.(message.id, reaction.emoji)}
                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                      isReacted
                        ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
                    }`}
                    aria-label={`${reaction.emoji} ${reaction.userIds.length}`}
                  >
                    <span>{reaction.emoji}</span>
                    <span>{reaction.userIds.length}</span>
                  </button>
                );
              })}
            </div>
          )}

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

          {/* Seen by (group chats only, own messages) */}
          {isOwn && isGroup && seenBy && seenBy.length > 0 && (
            <SeenByIndicator seenBy={seenBy} />
          )}
        </div>
      </div>
    </div>
  );
}
