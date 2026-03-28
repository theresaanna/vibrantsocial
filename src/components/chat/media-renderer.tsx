"use client";

import { useState } from "react";
import type { MediaType } from "@/types/chat";

interface MediaRendererProps {
  mediaUrl: string;
  mediaType: MediaType;
  mediaFileName: string | null;
  mediaFileSize: number | null;
  isOwn: boolean;
  isNsfw?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function NsfwOverlay({ onReveal }: { onReveal: () => void }) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl bg-zinc-900/80 px-6 py-8 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-8 w-8 text-zinc-400"
      >
        <path d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.092 1.092a4 4 0 00-5.558-5.558z" />
        <path d="M10.748 13.93l2.523 2.523A9.987 9.987 0 0110 17a10.004 10.004 0 01-9.335-6.41 1.651 1.651 0 010-1.185A10.027 10.027 0 014.09 5.153l2.077 2.077a4 4 0 004.581 4.7z" />
      </svg>
      <p className="text-sm font-medium text-zinc-300">
        Sensitive content
      </p>
      <button
        onClick={onReveal}
        className="mt-1 rounded-lg bg-zinc-700 px-4 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
      >
        Click to view
      </button>
    </div>
  );
}

export function MediaRenderer({
  mediaUrl,
  mediaType,
  mediaFileName,
  mediaFileSize,
  isOwn,
  isNsfw = false,
}: MediaRendererProps) {
  const [revealed, setRevealed] = useState(false);

  // Show NSFW overlay for images and videos
  if (isNsfw && !revealed && (mediaType === "image" || mediaType === "video")) {
    return <NsfwOverlay onReveal={() => setRevealed(true)} />;
  }

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
