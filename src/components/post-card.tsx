"use client";

import { useState } from "react";
import { PostContent } from "./post-content";
import { PostActions } from "./post-actions";
import { CommentSection } from "./comment-section";
import { timeAgo } from "@/lib/time";
import Link from "next/link";

interface PostAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatar: string | null;
}

interface CommentData {
  id: string;
  content: string;
  createdAt: Date;
  author: PostAuthor;
}

interface PostCardProps {
  post: {
    id: string;
    content: string;
    createdAt: Date;
    isSensitive: boolean;
    isNsfw: boolean;
    author: PostAuthor;
    _count: {
      comments: number;
      likes: number;
      bookmarks: number;
      reposts: number;
    };
    likes: Array<{ id: string }>;
    bookmarks: Array<{ id: string }>;
    reposts: Array<{ id: string }>;
    comments: CommentData[];
  };
  phoneVerified: boolean;
  biometricVerified: boolean;
  showNsfwByDefault: boolean;
  defaultShowComments?: boolean;
  highlightCommentId?: string | null;
}

export function PostCard({
  post,
  phoneVerified,
  biometricVerified,
  showNsfwByDefault,
  defaultShowComments = false,
  highlightCommentId,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [revealed, setRevealed] = useState(false);

  const authorName =
    post.author.displayName || post.author.name || "Anonymous";
  const authorInitial = authorName[0].toUpperCase();
  const avatarSrc = post.author.avatar || post.author.image;

  const isRestricted = post.isSensitive || post.isNsfw;

  // Determine if content should be hidden
  let showOverlay = false;
  let overlayMessage = "";
  let canReveal = false;
  let badge = "";

  if (isRestricted && !revealed) {
    if (!biometricVerified) {
      // Not verified: locked, no way to reveal
      showOverlay = true;
      overlayMessage = "Verify your age to view this content.";
      canReveal = false;
      badge = post.isNsfw ? "NSFW" : "Sensitive";
    } else if (post.isSensitive) {
      // Sensitive posts always require click-to-reveal
      showOverlay = true;
      overlayMessage = "Click to view sensitive content";
      canReveal = true;
      badge = "Sensitive";
    } else if (post.isNsfw) {
      if (showNsfwByDefault) {
        // User opted to see NSFW by default
        showOverlay = false;
        badge = "NSFW";
      } else {
        showOverlay = true;
        overlayMessage = "Click to view NSFW content";
        canReveal = true;
        badge = "NSFW";
      }
    }
  }

  // Show badge even when revealed
  if (post.isSensitive && !showOverlay) badge = "Sensitive";
  if (post.isNsfw && !showOverlay) badge = "NSFW";
  if (post.isSensitive && post.isNsfw && !showOverlay) badge = "Sensitive / NSFW";

  return (
    <div className="rounded-2xl bg-white shadow-lg dark:bg-zinc-900">
      {/* Author header — always visible */}
      <div className="flex items-center gap-3 px-4 pt-4">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            referrerPolicy="no-referrer"
            className="h-10 w-10 rounded-full"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {authorInitial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {post.author.username ? (
                <Link
                  href={`/${post.author.username}`}
                  className="hover:underline"
                >
                  {authorName}
                </Link>
              ) : (
                authorName
              )}
            </span>
            {post.author.username && (
              <Link
                href={`/${post.author.username}`}
                className="truncate text-sm text-zinc-500 hover:underline"
              >
                @{post.author.username}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-zinc-400">
              {timeAgo(new Date(post.createdAt))}
            </p>
            {badge && (
              <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                {badge}
              </span>
            )}
          </div>
        </div>
      </div>

      {showOverlay ? (
        <div className="px-4 py-6">
          <div className="flex flex-col items-center justify-center rounded-lg bg-zinc-100 py-8 dark:bg-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {overlayMessage}
            </p>
            {canReveal && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Show content
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Post content */}
          <div className="px-4 py-3">
            <PostContent content={post.content} />
          </div>

          {/* Actions */}
          <div className="border-t border-zinc-100 px-2 py-1 dark:border-zinc-800">
            <PostActions
              postId={post.id}
              likeCount={post._count.likes}
              commentCount={post._count.comments}
              repostCount={post._count.reposts}
              bookmarkCount={post._count.bookmarks}
              isLiked={post.likes.length > 0}
              isBookmarked={post.bookmarks.length > 0}
              isReposted={post.reposts.length > 0}
              onToggleComments={() => setShowComments((prev) => !prev)}
            />
          </div>

          {/* Comments */}
          {showComments && (
            <CommentSection
              postId={post.id}
              comments={post.comments}
              phoneVerified={phoneVerified}
              highlightCommentId={highlightCommentId}
            />
          )}
        </>
      )}
    </div>
  );
}
