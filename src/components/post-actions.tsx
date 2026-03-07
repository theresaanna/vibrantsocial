"use client";

import { useActionState, useOptimistic } from "react";
import {
  toggleLike,
  toggleBookmark,
  toggleRepost,
} from "@/app/feed/post-actions";

interface PostActionsProps {
  postId: string;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  bookmarkCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  isReposted: boolean;
  onToggleComments: () => void;
}

const initial = { success: false, message: "" };

export function PostActions({
  postId,
  likeCount,
  commentCount,
  repostCount,
  bookmarkCount,
  isLiked,
  isBookmarked,
  isReposted,
  onToggleComments,
}: PostActionsProps) {
  const [optimisticLiked, setOptimisticLiked] = useOptimistic(isLiked);
  const [optimisticLikeCount, setOptimisticLikeCount] = useOptimistic(likeCount);
  const [optimisticReposted, setOptimisticReposted] = useOptimistic(isReposted);
  const [optimisticRepostCount, setOptimisticRepostCount] = useOptimistic(repostCount);
  const [optimisticBookmarked, setOptimisticBookmarked] = useOptimistic(isBookmarked);
  const [optimisticBookmarkCount, setOptimisticBookmarkCount] = useOptimistic(bookmarkCount);

  const [, baseLikeAction, likePending] = useActionState(toggleLike, initial);
  const [, baseRepostAction, repostPending] = useActionState(toggleRepost, initial);
  const [, baseBookmarkAction, bookmarkPending] = useActionState(
    toggleBookmark,
    initial
  );

  const likeAction = (formData: FormData) => {
    setOptimisticLiked(!optimisticLiked);
    setOptimisticLikeCount(optimisticLiked ? optimisticLikeCount - 1 : optimisticLikeCount + 1);
    return baseLikeAction(formData);
  };

  const repostAction = (formData: FormData) => {
    setOptimisticReposted(!optimisticReposted);
    setOptimisticRepostCount(optimisticReposted ? optimisticRepostCount - 1 : optimisticRepostCount + 1);
    return baseRepostAction(formData);
  };

  const bookmarkAction = (formData: FormData) => {
    setOptimisticBookmarked(!optimisticBookmarked);
    setOptimisticBookmarkCount(optimisticBookmarked ? optimisticBookmarkCount - 1 : optimisticBookmarkCount + 1);
    return baseBookmarkAction(formData);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Like */}
      <form action={likeAction}>
        <input type="hidden" name="postId" value={postId} />
        <button
          type="submit"
          disabled={likePending}
          className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 ${
            optimisticLiked
              ? "text-red-500"
              : "text-zinc-500 hover:text-red-500"
          }`}
        >
          <svg
            className="h-4 w-4"
            fill={optimisticLiked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
          {optimisticLikeCount > 0 && <span>{optimisticLikeCount}</span>}
        </button>
      </form>

      {/* Comment */}
      <button
        type="button"
        onClick={onToggleComments}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-900/20"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
          />
        </svg>
        {commentCount > 0 && <span>{commentCount}</span>}
      </button>

      {/* Repost */}
      <form action={repostAction}>
        <input type="hidden" name="postId" value={postId} />
        <button
          type="submit"
          disabled={repostPending}
          className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-green-50 dark:hover:bg-green-900/20 ${
            optimisticReposted
              ? "text-green-500"
              : "text-zinc-500 hover:text-green-500"
          }`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"
            />
          </svg>
          {optimisticRepostCount > 0 && <span>{optimisticRepostCount}</span>}
        </button>
      </form>

      {/* Bookmark */}
      <form action={bookmarkAction}>
        <input type="hidden" name="postId" value={postId} />
        <button
          type="submit"
          disabled={bookmarkPending}
          className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-yellow-50 dark:hover:bg-yellow-900/20 ${
            optimisticBookmarked
              ? "text-yellow-500"
              : "text-zinc-500 hover:text-yellow-500"
          }`}
        >
          <svg
            className="h-4 w-4"
            fill={optimisticBookmarked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
            />
          </svg>
          {optimisticBookmarkCount > 0 && <span>{optimisticBookmarkCount}</span>}
        </button>
      </form>
    </div>
  );
}
