"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import { PostContent } from "./post-content";
import { PostActions } from "./post-actions";
import { CommentSection } from "./comment-section";
import { PostRevisionHistory } from "./post-revision-history";
import { Editor } from "./editor/Editor";
import { editPost, deletePost } from "@/app/feed/actions";
import { QuotePostModal } from "./quote-post-modal";
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
    editedAt?: Date | null;
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
  currentUserId?: string;
  phoneVerified: boolean;
  biometricVerified: boolean;
  showNsfwByDefault: boolean;
  defaultShowComments?: boolean;
  highlightCommentId?: string | null;
}

export function PostCard({
  post,
  currentUserId,
  phoneVerified,
  biometricVerified,
  showNsfwByDefault,
  defaultShowComments = false,
  highlightCommentId,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [revealed, setRevealed] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showRevisionHistory, setShowRevisionHistory] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [currentContent, setCurrentContent] = useState(post.content);
  const [wasEdited, setWasEdited] = useState(!!post.editedAt);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAuthor = currentUserId === post.author.id;

  const [, editAction, editPending] = useActionState(editPost, {
    success: false,
    message: "",
  });

  const [, deleteAction, deletePending] = useActionState(
    async (prevState: { success: boolean; message: string }, formData: FormData) => {
      const result = await deletePost(prevState, formData);
      if (result.success) setDeleted(true);
      return result;
    },
    { success: false, message: "" }
  );

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showMenu]);

  if (deleted) return null;

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
      showOverlay = true;
      overlayMessage = "Verify your age to view this content.";
      canReveal = false;
      badge = post.isNsfw ? "NSFW" : "Sensitive";
    } else if (post.isSensitive) {
      showOverlay = true;
      overlayMessage = "Click to view sensitive content";
      canReveal = true;
      badge = "Sensitive";
    } else if (post.isNsfw) {
      if (showNsfwByDefault) {
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

  if (post.isSensitive && !showOverlay) badge = "Sensitive";
  if (post.isNsfw && !showOverlay) badge = "NSFW";
  if (post.isSensitive && post.isNsfw && !showOverlay) badge = "Sensitive / NSFW";

  async function handleEditSubmit(formData: FormData) {
    const result = await editPost({ success: false, message: "" }, formData);
    if (result.success) {
      setCurrentContent(formData.get("content") as string);
      setWasEdited(true);
      setIsEditing(false);
    }
  }

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
            <Link
              href={`/post/${post.id}`}
              className="text-xs text-zinc-400 hover:underline"
            >
              {timeAgo(new Date(post.createdAt))}
            </Link>
            {wasEdited && (
              <span className="text-xs text-zinc-400">(edited)</span>
            )}
            {badge && (
              <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                {badge}
              </span>
            )}
          </div>
        </div>

        {/* Author menu */}
        {isAuthor && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              data-testid="post-menu-button"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  data-testid="post-edit-button"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRevisionHistory(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  data-testid="post-revision-history-button"
                >
                  Revision history
                </button>
                <form action={deleteAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button
                    type="submit"
                    disabled={deletePending}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-zinc-700"
                    data-testid="post-delete-button"
                  >
                    Delete
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
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
            {isEditing ? (
              <form action={handleEditSubmit}>
                <input type="hidden" name="postId" value={post.id} />
                <div data-testid="post-edit-editor">
                  <Editor
                    initialContent={currentContent}
                    inputName="content"
                    placeholder="Edit your post..."
                    minHeight="80px"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={editPending}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    data-testid="post-edit-save"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    data-testid="post-edit-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <PostContent content={currentContent} />
            )}
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
              onQuotePost={() => setShowQuoteModal(true)}
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

      {/* Revision history modal */}
      {showRevisionHistory && (
        <PostRevisionHistory
          postId={post.id}
          onClose={() => setShowRevisionHistory(false)}
          onRestore={(content) => {
            setCurrentContent(content);
            setWasEdited(true);
          }}
        />
      )}

      {/* Quote post modal */}
      {showQuoteModal && (
        <QuotePostModal
          postId={post.id}
          originalAuthor={post.author.username || "unknown"}
          originalContent={currentContent}
          onClose={() => setShowQuoteModal(false)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
