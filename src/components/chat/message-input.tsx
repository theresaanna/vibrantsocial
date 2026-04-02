"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { upload as blobUpload } from "@vercel/blob/client";
import { VoiceRecorder } from "./voice-recorder";
import { getChatFileLimitsHint, getLimitsForTier, type UserTier } from "@/lib/limits";
import { useTypeahead } from "@/hooks/use-typeahead";
import { TypeaheadDropdown } from "@/components/typeahead-dropdown";
import type { MessageData } from "@/types/chat";

export interface MediaAttachment {
  url: string;
  type: string;
  fileName: string;
  fileSize: number;
}

interface MessageInputProps {
  onSendMessage: (content: string, media?: MediaAttachment[]) => Promise<void>;
  onKeystroke: () => void;
  onStopTyping: () => void;
  disabled?: boolean;
  phoneVerified?: boolean;
  blockedMessage?: string;
  onEditLastMessage?: () => void;
  replyingTo?: MessageData | null;
  onCancelReply?: () => void;
  hasCustomTheme?: boolean;
}

export function MessageInput({
  onSendMessage,
  onKeystroke,
  onStopTyping,
  disabled,
  phoneVerified = true,
  blockedMessage,
  onEditLastMessage,
  replyingTo,
  onCancelReply,
  hasCustomTheme,
}: MessageInputProps) {
  const searchParams = useSearchParams();
  const statusReplyConsumed = useRef(false);
  const [value, setValue] = useState(() => {
    // Cannot read searchParams during SSR initial render, handled in effect below
    return "";
  });
  const [isSending, setIsSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();
  const tier = (session?.user?.tier as UserTier) ?? "free";
  const limits = useMemo(() => getLimitsForTier(tier), [tier]);

  const hasMedia = selectedFiles.length > 0 || !!voiceBlob;

  const setValueStable = useCallback((v: string) => setValue(v), []);
  const typeahead = useTypeahead({
    value,
    setValue: setValueStable,
    inputRef: textareaRef as React.RefObject<HTMLTextAreaElement | null>,
  });

  // Focus textarea when replying starts
  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  // Re-focus textarea after sending completes
  useEffect(() => {
    if (!isSending) {
      textareaRef.current?.focus();
    }
  }, [isSending]);

  // Prefill textarea from statusReply query param (one-time)
  useEffect(() => {
    if (statusReplyConsumed.current) return;
    const reply = searchParams.get("statusReply");
    if (reply) {
      statusReplyConsumed.current = true;
      setValue(reply);
      // Clean up the URL so refreshing doesn't re-prefill
      const url = new URL(window.location.href);
      url.searchParams.delete("statusReply");
      window.history.replaceState({}, "", url.toString());
      // Focus and move cursor to end
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.selectionStart = ta.selectionEnd = reply.length;
          // Trigger auto-resize
          ta.style.height = "auto";
          ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
        }
      });
    }
  }, [searchParams]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if ((!trimmed && !hasMedia) || isSending) return;

    setIsSending(true);
    setUploadError(null);
    try {
      const mediaList: MediaAttachment[] = [];

      if (selectedFiles.length > 0 || voiceBlob) {
        setIsUploading(true);

        if (voiceBlob) {
          const formData = new FormData();
          const ext = voiceBlob.type.includes("webm") ? "webm" : "ogg";
          formData.append("file", voiceBlob, `voice-message.${ext}`);

          const res = await fetch("/api/upload", { method: "POST", body: formData });
          if (!res.ok) {
            const err = await res.json();
            setUploadError(err.error ?? "Upload failed");
            return;
          }
          const data = await res.json();
          mediaList.push({
            url: data.url,
            type: data.fileType,
            fileName: data.fileName,
            fileSize: data.fileSize,
          });
        } else {
          for (const file of selectedFiles) {
            const mimeBase = file.type.split(";")[0].trim();
            const isVideo = mimeBase.startsWith("video/");

            if (isVideo) {
              // Use client-side Vercel Blob upload for videos to avoid
              // the 4.5 MB serverless function body-size limit.
              try {
                const blob = await blobUpload(file.name, file, {
                  access: "public",
                  handleUploadUrl: "/api/upload/client",
                  clientPayload: "video",
                });
                mediaList.push({
                  url: blob.url,
                  type: "video",
                  fileName: file.name,
                  fileSize: file.size,
                });
              } catch (err) {
                setUploadError(
                  err instanceof Error ? err.message : `Upload failed for ${file.name}`
                );
                return;
              }
            } else {
              const formData = new FormData();
              formData.append("file", file);

              const res = await fetch("/api/upload", { method: "POST", body: formData });
              if (!res.ok) {
                const err = await res.json();
                setUploadError(err.error ?? `Upload failed for ${file.name}`);
                return;
              }
              const data = await res.json();
              mediaList.push({
                url: data.url,
                type: data.fileType,
                fileName: data.fileName,
                fileSize: data.fileSize,
              });
            }
          }
        }

        setIsUploading(false);
      }

      await onSendMessage(trimmed, mediaList.length > 0 ? mediaList : undefined);
      setValue("");
      setSelectedFiles([]);
      setVoiceBlob(null);
      onStopTyping();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setIsSending(false);
      setIsUploading(false);
      // Re-focus the textarea after send completes
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Let typeahead handle key events first (Enter, Arrow, Escape, Tab)
    if (typeahead.handleKeyDown(e)) return;

    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "ArrowUp" && !value && onEditLastMessage) {
      e.preventDefault();
      onEditLastMessage();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    onKeystroke();

    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Eagerly snapshot the FileList into an array before resetting the input,
      // because e.target.value = "" clears the live FileList and React's
      // batched state updater would otherwise see an empty list.
      const fileArray = Array.from(files);
      setSelectedFiles((prev) => [...prev, ...fileArray]);
      setVoiceBlob(null);
      setUploadError(null);
    }
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  if (!phoneVerified) {
    return (
      <div className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href="/verify-phone"
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Verify your phone number
          </Link>{" "}
          to send messages.
        </p>
      </div>
    );
  }

  if (blockedMessage) {
    return (
      <div className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          {blockedMessage}
        </p>
      </div>
    );
  }

  // Voice recording mode
  if (isRecording) {
    return (
      <div className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <VoiceRecorder
          onRecordingComplete={(blob) => {
            setVoiceBlob(blob);
            setIsRecording(false);
          }}
          onCancel={() => setIsRecording(false)}
          maxDuration={limits.maxVoiceNoteDuration}
        />
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Reply preview bar */}
      {replyingTo && (
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2 dark:border-zinc-800" data-testid="reply-preview">
          <div className="flex-1 min-w-0 border-l-2 border-blue-500 pl-2">
            <span className="block truncate text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {replyingTo.sender.displayName ?? replyingTo.sender.username ?? replyingTo.sender.name ?? "User"}
            </span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
              {replyingTo.deletedAt
                ? "This message was deleted"
                : replyingTo.mediaType && !replyingTo.content
                  ? `[${replyingTo.mediaType}]`
                  : replyingTo.content.length > 100
                    ? replyingTo.content.slice(0, 100) + "..."
                    : replyingTo.content}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="flex-shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700"
            aria-label="Cancel reply"
            data-testid="cancel-reply"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      )}

      {/* File/voice preview */}
      {(selectedFiles.length > 0 || voiceBlob) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
          {selectedFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center gap-2" data-testid="file-preview">
              {file.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt="Preview"
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-zinc-400">
                    <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l3.122 3.12a1.5 1.5 0 01.439 1.061V16.5A1.5 1.5 0 0114.5 18h-10A1.5 1.5 0 013 16.5v-13z" />
                  </svg>
                </div>
              )}
              <span className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
                  setUploadError(null);
                }}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700"
                aria-label={`Remove ${file.name}`}
                data-testid="remove-attachment"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          ))}
          {voiceBlob && (
            <div className="flex items-center gap-2" data-testid="voice-preview">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-red-500">
                  <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
                  <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
                </svg>
              </div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Voice message</span>
              <button
                type="button"
                onClick={() => {
                  setVoiceBlob(null);
                  setUploadError(null);
                }}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700"
                aria-label="Remove attachment"
                data-testid="remove-attachment"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="px-4 py-2">
          <p className="text-xs text-red-500" data-testid="upload-error">{uploadError}</p>
        </div>
      )}

      {/* Input row */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 px-4 py-3"
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/heic,image/heif,video/mp4,video/webm,video/quicktime,video/ogg,application/pdf,audio/webm,audio/ogg,audio/mp4,audio/mpeg"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          data-testid="file-input"
        />

        {/* Attach file button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRecording || !!voiceBlob || isSending}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Attach file"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onInput={typeahead.detectTrigger}
          onClick={typeahead.detectTrigger}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled || isSending}
          rows={1}
          className={`flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400 ${
            hasCustomTheme ? "chat-input-themed" : "focus:border-blue-500"
          }`}
        />

        {/* Voice record button - show when no text and no file */}
        {!value.trim() && !hasMedia && (
          <button
            type="button"
            onClick={() => setIsRecording(true)}
            disabled={isSending || disabled}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Record voice message"
            data-testid="voice-record-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
              <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
            </svg>
          </button>
        )}

        {/* Send button - show when there's content or media */}
        {(value.trim() || hasMedia) && (
          <button
            type="submit"
            disabled={(!value.trim() && !hasMedia) || isSending || disabled}
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
              hasCustomTheme
                ? "chat-btn-themed"
                : "bg-blue-500 text-white hover:bg-blue-600 disabled:hover:bg-blue-500"
            }`}
            aria-label="Send message"
          >
            {isUploading ? (
              <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
              </svg>
            )}
          </button>
        )}
      </form>

      {/* File limits hint - only shown when interacting with attachments */}
      {(hasMedia || isRecording || uploadError) && (
        <p
          className="px-4 pb-2 text-center text-[11px] text-zinc-400 dark:text-zinc-500"
          data-testid="chat-file-limits"
        >
          {getChatFileLimitsHint(limits)}
        </p>
      )}

      {/* @mention and #hashtag typeahead dropdown */}
      {typeahead.isOpen && (
        <TypeaheadDropdown
          mode={typeahead.mode}
          mentionResults={typeahead.mentionResults}
          tagResults={typeahead.tagResults}
          selectedIndex={typeahead.selectedIndex}
          dropdownPos={typeahead.dropdownPos}
          dropdownRef={typeahead.dropdownRef}
          insertMention={typeahead.insertMention}
          insertHashtag={typeahead.insertHashtag}
        />
      )}
    </div>
  );
}
