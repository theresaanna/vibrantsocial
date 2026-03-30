"use client";

import { useState } from "react";
import {
  toggleRepostLike,
  toggleRepostBookmark,
  toggleRepost,
} from "@/app/feed/post-actions";
import { useOptimisticToggle } from "@/hooks/use-optimistic-toggle";

interface QuotePostActionsProps {
  repostId: string;
  postId: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  onToggleComments: () => void;
  onQuotePost?: () => void;
  readOnly?: boolean;
}

export function QuotePostActions({
  repostId,
  postId,
  likeCount,
  commentCount,
  bookmarkCount,
  isLiked,
  isBookmarked,
  onToggleComments,
  onQuotePost,
  readOnly,
}: QuotePostActionsProps) {
  const like = useOptimisticToggle(isLiked, likeCount, toggleRepostLike, { repostId });
  const bookmark = useOptimisticToggle(isBookmarked, bookmarkCount, toggleRepostBookmark, { repostId });
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/quote/${repostId}`;

    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Like */}
      {readOnly ? (
        <span className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-zinc-400" data-testid="quote-like-readonly">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          {like.count > 0 && <span>{like.count}</span>}
        </span>
      ) : (
        <button
          type="button"
          onClick={like.handleToggle}
          className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 ${
            like.value ? "text-red-500" : "text-zinc-500 hover:text-red-500"
          }`}
          aria-label={like.value ? "Unlike" : "Like"}
          data-testid="quote-like-button"
        >
          <svg
            className="h-4 w-4"
            fill={like.value ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          {like.count > 0 && <span>{like.count}</span>}
        </button>
      )}

      {/* Comment */}
      <button
        type="button"
        onClick={onToggleComments}
        className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-900/20 ${
          commentCount > 0 ? "text-blue-500" : "text-zinc-500"
        }`}
        data-testid="quote-comment-button"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
        </svg>
        {commentCount > 0 && <span>{commentCount}</span>}
      </button>

      {/* Repost / Quote (targets the original post) */}
      {onQuotePost && !readOnly && (
        <button
          type="button"
          onClick={onQuotePost}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-green-50 hover:text-green-500 dark:hover:bg-green-900/20"
          aria-label="Quote Post"
          data-testid="quote-repost-button"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
          </svg>
        </button>
      )}

      {/* Bookmark */}
      {readOnly ? (
        <span className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-zinc-400" data-testid="quote-bookmark-readonly">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
          {bookmark.count > 0 && <span>{bookmark.count}</span>}
        </span>
      ) : (
        <button
          type="button"
          onClick={bookmark.handleToggle}
          className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-yellow-50 dark:hover:bg-yellow-900/20 ${
            bookmark.value ? "text-yellow-500" : "text-zinc-500 hover:text-yellow-500"
          }`}
          aria-label={bookmark.value ? "Unbookmark" : "Bookmark"}
          data-testid="quote-bookmark-button"
        >
          <svg
            className="h-4 w-4"
            fill={bookmark.value ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
          {bookmark.count > 0 && <span>{bookmark.count}</span>}
        </button>
      )}

      {/* Share */}
      <button
        type="button"
        onClick={handleShare}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-purple-50 hover:text-purple-500 dark:hover:bg-purple-900/20 dark:hover:text-purple-500"
        aria-label="Share"
        data-testid="quote-share-button"
      >
        {copied ? (
          <span className="text-xs font-medium text-green-600">Copied!</span>
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
        )}
      </button>
    </div>
  );
}
