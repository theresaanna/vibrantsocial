"use client";

import { useState } from "react";
import { MessageRequestCard } from "./message-request-card";
import type { MessageRequestData } from "@/types/chat";

interface MessageRequestListProps {
  requests: MessageRequestData[];
}

export function MessageRequestList({ requests }: MessageRequestListProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (requests.length === 0) return null;

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
      >
        <span className="flex items-center gap-2">
          Message Requests
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-medium text-white">
            {requests.length}
          </span>
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isExpanded && (
        <div className="space-y-2 px-3 pb-3">
          {requests.map((request) => (
            <MessageRequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
