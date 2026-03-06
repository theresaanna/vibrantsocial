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
}

export function PostCard({ post, phoneVerified }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);

  const authorName =
    post.author.displayName || post.author.name || "Anonymous";
  const authorInitial = authorName[0].toUpperCase();
  const avatarSrc = post.author.avatar || post.author.image;

  return (
    <div className="rounded-2xl bg-white shadow-lg dark:bg-zinc-900">
      {/* Author header */}
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
          <p className="text-xs text-zinc-400">
            {timeAgo(new Date(post.createdAt))}
          </p>
        </div>
      </div>

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
        />
      )}
    </div>
  );
}
