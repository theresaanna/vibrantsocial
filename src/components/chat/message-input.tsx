"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { VoiceRecorder } from "./voice-recorder";

export interface MediaAttachment {
  url: string;
  type: string;
  fileName: string;
  fileSize: number;
}

interface MessageInputProps {
  onSendMessage: (content: string, media?: MediaAttachment) => Promise<void>;
  onKeystroke: () => void;
  onStopTyping: () => void;
  disabled?: boolean;
  phoneVerified?: boolean;
  onEditLastMessage?: () => void;
}

export function MessageInput({
  onSendMessage,
  onKeystroke,
  onStopTyping,
  disabled,
  phoneVerified = true,
  onEditLastMessage,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasMedia = !!selectedFile || !!voiceBlob;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if ((!trimmed && !hasMedia) || isSending) return;

    setIsSending(true);
    setUploadError(null);
    try {
      let media: MediaAttachment | undefined;

      if (selectedFile || voiceBlob) {
        setIsUploading(true);
        const formData = new FormData();
        if (voiceBlob) {
          const ext = voiceBlob.type.includes("webm") ? "webm" : "ogg";
          formData.append("file", voiceBlob, `voice-message.${ext}`);
        } else {
          formData.append("file", selectedFile!);
        }

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json();
          setUploadError(err.error ?? "Upload failed");
          return;
        }
        const data = await res.json();
        media = {
          url: data.url,
          type: data.fileType,
          fileName: data.fileName,
          fileSize: data.fileSize,
        };
        setIsUploading(false);
      }

      await onSendMessage(trimmed, media);
      setValue("");
      setSelectedFile(null);
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
    if (e.key === "Enter" && !e.shiftKey) {
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
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
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
        />
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* File/voice preview */}
      {(selectedFile || voiceBlob) && (
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
          {selectedFile && (
            <div className="flex items-center gap-2" data-testid="file-preview">
              {selectedFile.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(selectedFile)}
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
                {selectedFile.name}
              </span>
            </div>
          )}
          {voiceBlob && (
            <div className="flex items-center gap-2" data-testid="voice-preview">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-red-500">
                  <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
                  <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
                </svg>
              </div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Voice message</span>
            </div>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => {
              setSelectedFile(null);
              setVoiceBlob(null);
              setUploadError(null);
            }}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700"
            aria-label="Remove attachment"
            data-testid="remove-attachment"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
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
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled || isSending}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-500 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
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
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500"
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
    </div>
  );
}
