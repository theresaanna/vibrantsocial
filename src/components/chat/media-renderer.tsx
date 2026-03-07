"use client";

import type { MediaType } from "@/types/chat";

interface MediaRendererProps {
  mediaUrl: string;
  mediaType: MediaType;
  mediaFileName: string | null;
  mediaFileSize: number | null;
  isOwn: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaRenderer({
  mediaUrl,
  mediaType,
  mediaFileName,
  mediaFileSize,
  isOwn,
}: MediaRendererProps) {
  if (mediaType === "image") {
    return (
      <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={mediaUrl}
          alt={mediaFileName ?? "Image"}
          className="max-w-full rounded-xl"
          loading="lazy"
        />
      </a>
    );
  }

  if (mediaType === "video") {
    return (
      <video
        src={mediaUrl}
        controls
        preload="metadata"
        className="max-w-full rounded-xl"
      >
        Your browser does not support video playback.
      </video>
    );
  }

  if (mediaType === "audio") {
    return (
      <div className="min-w-[200px]">
        <audio src={mediaUrl} controls preload="metadata" className="w-full">
          Your browser does not support audio playback.
        </audio>
      </div>
    );
  }

  // document
  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
        isOwn
          ? "border-blue-400/30 hover:bg-blue-600/20"
          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-700/50"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-8 w-8 flex-shrink-0"
      >
        <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l3.122 3.12a1.5 1.5 0 01.439 1.061V16.5A1.5 1.5 0 0114.5 18h-10A1.5 1.5 0 013 16.5v-13z" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {mediaFileName ?? "Document"}
        </p>
        {mediaFileSize != null && (
          <p className={`text-xs ${isOwn ? "text-blue-100" : "text-zinc-500 dark:text-zinc-400"}`}>
            {formatFileSize(mediaFileSize)}
          </p>
        )}
      </div>
    </a>
  );
}
