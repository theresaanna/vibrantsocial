"use client";

import { useState, useTransition } from "react";
import { createQuoteRepost } from "@/app/feed/post-actions";

interface QuotePostModalProps {
  postId: string;
  originalAuthor: string;
  originalContent: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function QuotePostModal({
  postId,
  originalAuthor,
  originalContent,
  onClose,
  onSuccess,
}: QuotePostModalProps) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!content.trim() || pending) return;

    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("content", content.trim());

    startTransition(async () => {
      const result = await createQuoteRepost({ success: false, message: "" }, formData);
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.message);
      }
    });
  };

  // Parse original content for preview (handle Lexical JSON)
  let previewText = originalContent;
  try {
    const parsed = JSON.parse(originalContent);
    if (parsed?.root?.children) {
      previewText = parsed.root.children
        .map((node: { children?: Array<{ text?: string }> }) =>
          node.children?.map((c: { text?: string }) => c.text || "").join("") || ""
        )
        .filter(Boolean)
        .join("\n");
    }
  } catch {
    // Plain text content
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Quote Post
        </h2>

        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setError(null); }}
          placeholder="Add your commentary..."
          rows={3}
          maxLength={500}
          className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          autoFocus
          data-testid="quote-textarea"
        />

        <div className="mt-1 flex justify-between text-xs text-zinc-400">
          {error && <span className="text-red-500">{error}</span>}
          <span className="ml-auto">{content.length}/500</span>
        </div>

        {/* Original post preview */}
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            @{originalAuthor}
          </p>
          <p className="mt-1 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-300">
            {previewText.substring(0, 200)}
            {previewText.length > 200 && "..."}
          </p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim() || pending}
            className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
            data-testid="quote-submit"
          >
            {pending ? "Posting..." : "Quote Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
