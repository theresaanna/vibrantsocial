"use client";

import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { timeAgo } from "@/lib/time";
import { ReadReceiptIndicator } from "./read-receipt-indicator";
import { SeenByIndicator } from "./seen-by-indicator";
import { MediaRenderer } from "./media-renderer";
import { FramedAvatar } from "@/components/framed-avatar";
import type { MessageData, ChatUserProfile, MediaType, ChatThemeColors } from "@/types/chat";
import { LinkifyText, extractFirstUrlFromText, isImageUrl } from "./linkify-text";
import { LinkPreviewCard } from "@/components/link-preview-card";
import { StyledName } from "@/components/styled-name";

const LazyEmojiPicker = lazy(() => import("emoji-picker-react"));

// Matches 1-3 emoji with optional whitespace, no other text
const EMOJI_ONLY_RE = /^\s*(\p{Extended_Pictographic}[\u{FE00}-\u{FE0F}\u{200D}\p{Extended_Pictographic}]*){1,3}\s*$/u;

function isEmojiOnly(text: string): boolean {
  return EMOJI_ONLY_RE.test(text);
}

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
  onReply?: (message: MessageData) => void;
  onScrollToMessage?: (messageId: string) => void;
  currentUserId?: string;
  isEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  themeColors?: ChatThemeColors;
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
  onReply,
  onScrollToMessage,
  currentUserId,
  isEditing: externalIsEditing,
  onEditingChange,
  themeColors,
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
  const firstUrl = useMemo(
    () => (message.content ? extractFirstUrlFromText(message.content) : null),
    [message.content]
  );
  const [linkPreviewDismissed, setLinkPreviewDismissed] = useState(false);
  const [linkPreviewStatus, setLinkPreviewStatus] = useState<"loading" | "loaded" | "empty">("loading");
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [pickerSize, setPickerSize] = useState({ width: 350, height: 400 });
  const dragRef = useRef({ isDragging: false, offsetX: 0, offsetY: 0, didDrag: false });

  const handlePickerMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't drag if clicking inside the emoji picker's own UI (inputs, buttons, etc.)
    const target = e.target as HTMLElement;
    if (target.closest(".EmojiPickerReact")) return;

    e.preventDefault();
    dragRef.current.isDragging = true;
    dragRef.current.didDrag = false;
    dragRef.current.offsetX = e.clientX - (pickerPos?.left ?? 0);
    dragRef.current.offsetY = e.clientY - (pickerPos?.top ?? 0);

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current.isDragging) return;
      dragRef.current.didDrag = true;
      setPickerPos({
        left: ev.clientX - dragRef.current.offsetX,
        top: ev.clientY - dragRef.current.offsetY,
      });
    };

    const handleMouseUp = () => {
      dragRef.current.isDragging = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [pickerPos]);

  const openEmojiPicker = useCallback(() => {
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(350, vw - 16);
    const height = Math.min(400, vh - 100);
    setPickerSize({ width, height });

    if (emojiButtonRef.current) {
      const rect = emojiButtonRef.current.getBoundingClientRect();
      let top = rect.bottom + 4;
      let left = isOwn ? rect.right - width : rect.left;

      // Constrain to viewport
      left = Math.max(8, Math.min(left, vw - width - 8));
      if (top + height > vh - 8) {
        top = rect.top - height - 4;
      }
      top = Math.max(8, top);

      setPickerPos({ top, left });
    }
    setShowEmojiPicker(true);
  }, [showEmojiPicker, isOwn]);

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
      // Don't close if the user was dragging the picker
      if (dragRef.current.didDrag) {
        dragRef.current.didDrag = false;
        return;
      }
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(e.target as Node)
      ) {
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
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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
            {senderProfile.username ? (
              <Link href={`/${senderProfile.username}`}>
                <FramedAvatar
                  src={avatar}
                  alt={displayName}
                  initial={displayName[0]?.toUpperCase()}
                  size={36}
                  frameId={senderProfile.profileFrameId}
                />
              </Link>
            ) : (
              <FramedAvatar
                src={avatar}
                alt={displayName}
                initial={displayName[0]?.toUpperCase()}
                size={28}
                frameId={senderProfile.profileFrameId}
              />
            )}
          </div>
        )}

        <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
          {/* Sender name in group */}
          {isGroup && !isOwn && (
            <span
              className="mb-0.5 px-3 text-xs font-medium text-zinc-500 dark:text-zinc-400"
              style={themeColors?.linkColor ? { color: "var(--chat-link-color)" } : undefined}
            >
              <StyledName fontId={senderProfile.usernameFont}>{displayName}</StyledName>
            </span>
          )}

          {/* Reply quote */}
          {message.replyTo && (
            <button
              onClick={() => onScrollToMessage?.(message.replyTo!.id)}
              className={`mb-0.5 flex w-full cursor-pointer items-start gap-1.5 rounded-xl border-l-2 px-3 py-1.5 text-left transition-colors hover:opacity-80 ${
                isOwn
                  ? themeColors?.bgColor
                    ? ""
                    : "border-blue-300 bg-blue-400/20 dark:border-blue-400 dark:bg-blue-500/10"
                  : "border-zinc-400 bg-zinc-200/60 dark:border-zinc-500 dark:bg-zinc-700/60"
              }`}
              style={isOwn && themeColors?.bgColor ? {
                borderColor: "var(--chat-bubble-bg)",
                backgroundColor: "color-mix(in srgb, var(--chat-bubble-bg) 20%, transparent)",
              } : undefined}
              data-testid="reply-quote"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                  {message.replyTo.senderName}
                </span>
                {message.replyTo.deletedAt ? (
                  <span className="text-xs italic text-zinc-400">This message was deleted</span>
                ) : (
                  <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {message.replyTo.mediaType && !message.replyTo.content
                      ? `[${message.replyTo.mediaType}]`
                      : <LinkifyText
                          text={message.replyTo.content.length > 80
                            ? message.replyTo.content.slice(0, 80) + "..."
                            : message.replyTo.content}
                          asSpans
                        />}
                  </span>
                )}
              </div>
            </button>
          )}

          {/* Message content */}
          <div className="relative">
            {isEditing ? (
              <div className="flex flex-col gap-1">
                <textarea
                  ref={(el) => {
                    if (el) {
                      el.focus();
                      el.selectionStart = el.value.length;
                      el.selectionEnd = el.value.length;
                    }
                  }}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="min-w-[200px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  rows={2}
                />
                <div className="flex gap-1 text-xs">
                  <button
                    onClick={handleEditSubmit}
                    className="rounded px-2 py-0.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-zinc-800"
                    style={themeColors?.linkColor ? { color: "var(--chat-link-color)" } : undefined}
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
            ) : message.content && !message.mediaUrl && isEmojiOnly(message.content) ? (
              <p className="text-5xl leading-tight">{message.content}</p>
            ) : (
              <div
                className={`rounded-2xl px-3.5 py-2 text-sm ${
                  isOwn
                    ? `rounded-br-sm ${themeColors?.bgColor ? "" : "bg-blue-500 text-white"}`
                    : "rounded-bl-sm bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
                style={isOwn && themeColors?.bgColor ? { backgroundColor: "var(--chat-bubble-bg)", color: "var(--chat-bubble-text)" } : undefined}
              >
                {message.mediaUrl && message.mediaType && (
                  <div className="mb-1">
                    <MediaRenderer
                      mediaUrl={message.mediaUrl}
                      mediaType={message.mediaType as MediaType}
                      mediaFileName={message.mediaFileName}
                      mediaFileSize={message.mediaFileSize}
                      isOwn={isOwn}
                      isNsfw={message.isNsfw}
                    />
                  </div>
                )}
                {message.content && (
                  <p className="whitespace-pre-wrap break-words"><LinkifyText text={message.content} themed={!!themeColors?.linkColor} /></p>
                )}
                {firstUrl && !linkPreviewDismissed && (
                  isImageUrl(firstUrl) ? (
                    <div className="relative mt-1" data-testid="chat-link-preview">
                      <a href={firstUrl} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={firstUrl}
                          alt=""
                          className="max-w-full rounded-lg"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </a>
                      <button
                        type="button"
                        onClick={() => setLinkPreviewDismissed(true)}
                        className="absolute right-1 top-1 rounded-full bg-white/80 p-0.5 text-zinc-400 hover:bg-white hover:text-zinc-600 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                        aria-label="Dismiss link preview"
                        data-testid="dismiss-link-preview"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </div>
                  ) : linkPreviewStatus !== "empty" ? (
                    <div className="relative" data-testid="chat-link-preview">
                      <LinkPreviewCard url={firstUrl} onLoadChange={setLinkPreviewStatus} />
                      {linkPreviewStatus === "loaded" && (
                        <button
                          type="button"
                          onClick={() => setLinkPreviewDismissed(true)}
                          className="absolute right-1 top-4 rounded-full bg-white/80 p-0.5 text-zinc-400 hover:bg-white hover:text-zinc-600 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                          aria-label="Dismiss link preview"
                          data-testid="dismiss-link-preview"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ) : null
                )}
              </div>
            )}

            {/* Action buttons: context menu + emoji reaction trigger */}
            {!isEditing && (
              <div
                className={`absolute top-1/2 -translate-y-1/2 transition-opacity md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100 ${
                  isOwn ? "-left-16 flex flex-row" : "-right-16 flex flex-row-reverse"
                }`}
              >
                {/* Reply button */}
                <button
                  onClick={() => onReply?.(message)}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                  aria-label="Reply"
                  data-testid="reply-button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Emoji reaction button */}
                <div className="relative">
                  <button
                    ref={emojiButtonRef}
                    onClick={openEmojiPicker}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                    aria-label="Add reaction"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.536-4.464a.75.75 0 10-1.06-1.06 3.5 3.5 0 01-4.95 0 .75.75 0 00-1.06 1.06 5 5 0 007.07 0zM9 8.5c0 .828-.448 1.5-1 1.5s-1-.672-1-1.5S7.448 7 8 7s1 .672 1 1.5zm3 1.5c.552 0 1-.672 1-1.5S12.552 7 12 7s-1 .672-1 1.5.448 1.5 1 1.5z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {showEmojiPicker && pickerPos && createPortal(
                    <div
                      ref={emojiPickerRef}
                      className="fixed z-50 cursor-grab active:cursor-grabbing"
                      style={{ top: pickerPos.top, left: pickerPos.left }}
                      onMouseDown={handlePickerMouseDown}
                      data-testid="emoji-picker"
                    >
                      <Suspense
                        fallback={
                          <div
                            className="flex items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-400 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                            style={{ width: pickerSize.width, height: pickerSize.height }}
                          >
                            Loading...
                          </div>
                        }
                      >
                        <LazyEmojiPicker
                          onEmojiClick={(emojiData) => {
                            onReaction?.(message.id, emojiData.emoji);
                            setShowEmojiPicker(false);
                          }}
                          width={pickerSize.width}
                          height={pickerSize.height}
                          searchPlaceholder="Search emoji..."
                          previewConfig={{ showPreview: false }}
                        />
                      </Suspense>
                    </div>,
                    document.body
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
                        ? themeColors?.linkColor
                          ? "chat-reaction-active"
                          : "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
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
            {isOwn && <ReadReceiptIndicator status={readStatus} hasCustomTheme={!!themeColors?.bgColor} />}
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
