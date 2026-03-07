"use client";

import { useState, useEffect, useRef, useTransition } from "react";
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
  onQuotePost?: () => void;
}

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
  onQuotePost,
}: PostActionsProps) {
  const [liked, setLiked] = useState(isLiked);
  const [likes, setLikes] = useState(likeCount);
  const [reposted, setReposted] = useState(isReposted);
  const [reposts, setReposts] = useState(repostCount);
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [bookmarks, setBookmarks] = useState(bookmarkCount);

  // Sync state when server props change (e.g. after revalidation)
  useEffect(() => { setLiked(isLiked); }, [isLiked]);
  useEffect(() => { setLikes(likeCount); }, [likeCount]);
  useEffect(() => { setReposted(isReposted); }, [isReposted]);
  useEffect(() => { setReposts(repostCount); }, [repostCount]);
  useEffect(() => { setBookmarked(isBookmarked); }, [isBookmarked]);
  useEffect(() => { setBookmarks(bookmarkCount); }, [bookmarkCount]);

  const [, startLikeTransition] = useTransition();
  const [, startRepostTransition] = useTransition();
  const [, startBookmarkTransition] = useTransition();

  const likeInFlight = useRef(false);
  const repostInFlight = useRef(false);
  const bookmarkInFlight = useRef(false);

  const handleLike = () => {
    if (likeInFlight.current) return;
    likeInFlight.current = true;

    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikes((c) => wasLiked ? c - 1 : c + 1);

    const formData = new FormData();
    formData.set("postId", postId);
    startLikeTransition(async () => {
      const result = await toggleLike({ success: false, message: "" }, formData);
      if (!result.success) {
        setLiked(wasLiked);
        setLikes((c) => wasLiked ? c + 1 : c - 1);
      }
      likeInFlight.current = false;
    });
  };

  const handleRepost = () => {
    if (repostInFlight.current) return;
    repostInFlight.current = true;

    const wasReposted = reposted;
    setReposted(!wasReposted);
    setReposts((c) => wasReposted ? c - 1 : c + 1);

    const formData = new FormData();
    formData.set("postId", postId);
    startRepostTransition(async () => {
      const result = await toggleRepost({ success: false, message: "" }, formData);
      if (!result.success) {
        setReposted(wasReposted);
        setReposts((c) => wasReposted ? c + 1 : c - 1);
      }
      repostInFlight.current = false;
    });
  };

  const handleBookmark = () => {
    if (bookmarkInFlight.current) return;
    bookmarkInFlight.current = true;

    const wasBookmarked = bookmarked;
    setBookmarked(!wasBookmarked);
    setBookmarks((c) => wasBookmarked ? c - 1 : c + 1);

    const formData = new FormData();
    formData.set("postId", postId);
    startBookmarkTransition(async () => {
      const result = await toggleBookmark({ success: false, message: "" }, formData);
      if (!result.success) {
        setBookmarked(wasBookmarked);
        setBookmarks((c) => wasBookmarked ? c + 1 : c - 1);
      }
      bookmarkInFlight.current = false;
    });
  };

  return (
    <div className="flex items-center gap-1">
      {/* Like */}
      <button
        type="button"
        onClick={handleLike}
        className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 ${
          liked
            ? "text-red-500"
            : "text-zinc-500 hover:text-red-500"
        }`}
        aria-label={liked ? "Unlike" : "Like"}
      >
        <svg
          className="h-4 w-4"
          fill={liked ? "currentColor" : "none"}
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
        {likes > 0 && <span>{likes}</span>}
      </button>

      {/* Comment */}
      <button
        type="button"
        onClick={onToggleComments}
        className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-900/20 ${
          commentCount > 0 ? "text-blue-500" : "text-zinc-500"
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
            d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
          />
        </svg>
        {commentCount > 0 && <span>{commentCount}</span>}
      </button>

      {/* Repost */}
      <RepostButton
        reposted={reposted}
        reposts={reposts}
        onRepost={handleRepost}
        onQuotePost={onQuotePost}
      />

      {/* Bookmark */}
      <button
        type="button"
        onClick={handleBookmark}
        className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-yellow-50 dark:hover:bg-yellow-900/20 ${
          bookmarked
            ? "text-yellow-500"
            : "text-zinc-500 hover:text-yellow-500"
        }`}
        aria-label={bookmarked ? "Unbookmark" : "Bookmark"}
      >
        <svg
          className="h-4 w-4"
          fill={bookmarked ? "currentColor" : "none"}
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
        {bookmarks > 0 && <span>{bookmarks}</span>}
      </button>
    </div>
  );
}

function RepostButton({
  reposted,
  reposts,
  onRepost,
  onQuotePost,
}: {
  reposted: boolean;
  reposts: number;
  onRepost: () => void;
  onQuotePost?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  const handleClick = () => {
    if (reposted) {
      onRepost();
    } else {
      setShowMenu((v) => !v);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-green-50 dark:hover:bg-green-900/20 ${
          reposted
            ? "text-green-500"
            : "text-zinc-500 hover:text-green-500"
        }`}
        aria-label={reposted ? "Unrepost" : "Repost"}
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
        {reposts > 0 && <span>{reposts}</span>}
      </button>

      {showMenu && (
        <div className="absolute bottom-full left-0 z-10 mb-1 w-36 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => { setShowMenu(false); onRepost(); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
            </svg>
            Repost
          </button>
          {onQuotePost && (
            <button
              type="button"
              onClick={() => { setShowMenu(false); onQuotePost(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              Quote Post
            </button>
          )}
        </div>
      )}
    </div>
  );
}
