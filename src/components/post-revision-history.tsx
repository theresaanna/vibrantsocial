"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { EditorContent } from "@/components/editor/EditorContent";
import { getPostRevisions, restorePostRevision } from "@/app/feed/actions";
import { timeAgo } from "@/lib/time";

interface Revision {
  id: string;
  content: string;
  createdAt: Date;
}

interface PostRevisionHistoryProps {
  postId: string;
  onClose: () => void;
  onRestore: (content: string) => void;
}

export function PostRevisionHistory({
  postId,
  onClose,
  onRestore,
}: PostRevisionHistoryProps) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    getPostRevisions(postId).then((data) => {
      setRevisions(data.map((r: { id: string; content: string; createdAt: Date }) => ({ ...r, createdAt: new Date(r.createdAt) })));
      setLoading(false);
      if (data.length > 0) setSelectedId(data[0].id);
    });
  }, [postId]);

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [handleEsc]);

  const selected = revisions.find((r) => r.id === selectedId);

  async function handleRestore() {
    if (!selectedId) return;
    setRestoring(true);
    const result = await restorePostRevision(selectedId);
    setRestoring(false);
    if (result.success && result.restoredContent) {
      onRestore(result.restoredContent);
      onClose();
    }
  }

  function formatDate(date: Date) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} data-testid="revision-overlay" />
      <div className="relative z-10 flex h-[80vh] w-[90vw] max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-zinc-900" data-testid="post-revision-history">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Post Revision History
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close"
            data-testid="revision-close-button"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
              Loading revisions...
            </div>
          ) : revisions.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
              No previous revisions yet. Revisions are saved each time you
              edit this post.
            </div>
          ) : (
            <>
              {/* Revision list sidebar */}
              <div className="w-60 shrink-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-700">
                {revisions.map((rev) => (
                  <button
                    key={rev.id}
                    type="button"
                    onClick={() => setSelectedId(rev.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      rev.id === selectedId
                        ? "bg-zinc-100 dark:bg-zinc-800"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                    data-testid={`revision-item-${rev.id}`}
                  >
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {timeAgo(rev.createdAt)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDate(rev.createdAt)}
                    </p>
                  </button>
                ))}
              </div>

              {/* Preview panel */}
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4">
                  {selected ? (
                    <EditorContent content={selected.content} />
                  ) : (
                    <p className="text-sm text-zinc-400">
                      Select a revision to preview
                    </p>
                  )}
                </div>
                {selected && (
                  <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
                    <button
                      type="button"
                      onClick={handleRestore}
                      disabled={restoring}
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      data-testid="revision-restore-button"
                    >
                      {restoring ? "Restoring..." : "Restore this version"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
