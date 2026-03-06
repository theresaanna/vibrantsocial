"use client";

import { useState, useTransition } from "react";
import { MessageRequestCard } from "./message-request-card";
import { bulkDeclineMessageRequests } from "@/app/chat/actions";
import type { MessageRequestData } from "@/types/chat";

interface MessageRequestListProps {
  requests: MessageRequestData[];
}

export function MessageRequestList({ requests }: MessageRequestListProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  if (requests.length === 0) return null;

  const allSelected = requests.length > 0 && selectedIds.size === requests.length;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map((r) => r.id)));
    }
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    startTransition(async () => {
      await bulkDeclineMessageRequests(Array.from(selectedIds));
      exitSelectMode();
    });
  }

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
        <div className="px-3 pb-3">
          {/* Select mode toolbar */}
          <div className="mb-2 flex items-center justify-between">
            {selectMode ? (
              <>
                <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
                  />
                  Select all
                </label>
                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={isPending}
                      className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {isPending ? "..." : `Delete (${selectedIds.size})`}
                    </button>
                  )}
                  <button
                    onClick={exitSelectMode}
                    className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="ml-auto">
                <button
                  onClick={() => setSelectMode(true)}
                  className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Select
                </button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            {requests.map((request) => (
              <MessageRequestCard
                key={request.id}
                request={request}
                selectMode={selectMode}
                isSelected={selectedIds.has(request.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
