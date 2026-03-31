"use client";

import { useActionState, useState, useRef, useEffect, lazy, Suspense, useCallback } from "react";
import { createPortal } from "react-dom";
import { createRepostComment, fetchRepostComments, toggleRepostCommentReaction, editRepostComment, deleteRepostComment } from "@/app/feed/post-actions";
import { timeAgo } from "@/lib/time";
import Link from "next/link";
import { LinkifyText } from "@/components/chat/linkify-text";
import { FramedAvatar } from "@/components/framed-avatar";

const LazyEmojiPicker = lazy(() => import("emoji-picker-react"));

interface CommentAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatar: string | null;
  profileFrameId: string | null;
}

interface ReactionGroup {
  emoji: string;
  userIds: string[];
}

interface RepostCommentData {
  id: string;
  content: string;
  createdAt: Date | string;
  editedAt?: Date | string | null;
  parentId?: string | null;
  author: CommentAuthor;
  reactions?: ReactionGroup[];
  replies?: RepostCommentData[];
}

interface RepostCommentSectionProps {
  repostId: string;
  comments?: RepostCommentData[];
  phoneVerified: boolean;
  isAuthenticated?: boolean;
  currentUserId?: string;
  onCommentCountChange?: (count: number) => void;
}

export function RepostCommentSection({
  repostId,
  comments: initialComments,
  phoneVerified,
  isAuthenticated = true,
  currentUserId,
  onCommentCountChange,
}: RepostCommentSectionProps) {
  const [comments, setComments] = useState<RepostCommentData[]>(
    initialComments ?? []
  );
  const [loading, setLoading] = useState(!initialComments);

  // Lazy-load comments when not provided
  useEffect(() => {
    if (initialComments) return;
    let cancelled = false;
    fetchRepostComments(repostId).then((data) => {
      if (!cancelled) {
        setComments(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [repostId, initialComments]);

  useEffect(() => {
    if (!onCommentCountChange) return;
    function countAll(list: RepostCommentData[]): number {
      return list.reduce(
        (sum, c) => sum + 1 + countAll(c.replies ?? []),
        0
      );
    }
    onCommentCountChange(countAll(comments));
  }, [comments, onCommentCountChange]);

  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (prevState: { success: boolean; message: string }, formData: FormData) => {
      const result = await createRepostComment(prevState, formData);
      if (result.success) {
        setReplyingTo(null);
        if (inputRef.current) inputRef.current.value = "";
        // Refresh comments
        const updated = await fetchRepostComments(repostId);
        setComments(updated);
      }
      return result;
    },
    { success: false, message: "" }
  );

  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);

  const handleReaction = useCallback(async (commentId: string, emoji: string) => {
    if (!currentUserId) return;

    function updateDeep(list: RepostCommentData[]): RepostCommentData[] {
      return list.map((c) => {
        if (c.id === commentId) return applyReactionOptimistic(c, emoji, currentUserId!);
        if (c.replies) return { ...c, replies: updateDeep(c.replies) };
        return c;
      });
    }
    setComments(updateDeep);

    await toggleRepostCommentReaction({ commentId, emoji });
  }, [currentUserId]);

  const handleEdit = useCallback(async (commentId: string, content: string) => {
    function updateDeep(list: RepostCommentData[]): RepostCommentData[] {
      return list.map((c) => {
        if (c.id === commentId) return { ...c, content, editedAt: new Date() };
        if (c.replies) return { ...c, replies: updateDeep(c.replies) };
        return c;
      });
    }
    setComments(updateDeep);
    await editRepostComment({ commentId, content });
  }, []);

  const handleDelete = useCallback(async (commentId: string) => {
    function removeDeep(list: RepostCommentData[]): RepostCommentData[] {
      return list
        .filter((c) => c.id !== commentId)
        .map((c) => c.replies ? { ...c, replies: removeDeep(c.replies) } : c);
    }
    setComments(removeDeep);
    await deleteRepostComment({ commentId });
  }, []);

  if (loading) {
    return (
      <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <p className="text-sm text-zinc-400">Loading comments...</p>
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800" data-testid="repost-comment-section">
      {comments.length > 0 && (
        <div className="mb-3 space-y-3">
          {comments.map((comment) => (
            <RepostCommentThread
              key={comment.id}
              comment={comment}
              depth={0}
              onReply={isAuthenticated && phoneVerified ? (id, name) => setReplyingTo({ id, name }) : undefined}
              onReaction={isAuthenticated ? handleReaction : undefined}
              onEdit={handleEdit}
              onDelete={handleDelete}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {!isAuthenticated ? (
        <p className="text-sm text-zinc-500">
          <Link
            href="/login"
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Sign in
          </Link>{" "}
          to comment.
        </p>
      ) : phoneVerified ? (
        <div>
          {replyingTo && (
            <div className="mb-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
              <span>Replying to {replyingTo.name}</span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                Cancel
              </button>
            </div>
          )}
          <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="repostId" value={repostId} />
            {replyingTo && (
              <input type="hidden" name="parentId" value={replyingTo.id} />
            )}
            <input
              ref={inputRef}
              name="content"
              type="text"
              placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : "Write a comment..."}
              required
              maxLength={1000}
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={isPending}
              className="shrink-0 self-end rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isPending ? "..." : "Reply"}
            </button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          <Link
            href="/verify-phone"
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Verify your phone
          </Link>{" "}
          to comment.
        </p>
      )}

      {state.message && !state.success && (
        <p className="mt-1 text-sm text-red-600">{state.message}</p>
      )}
    </div>
  );
}

const MAX_VISUAL_DEPTH = 4;

function RepostCommentThread({
  comment,
  depth,
  onReply,
  onReaction,
  onEdit,
  onDelete,
  currentUserId,
}: {
  comment: RepostCommentData;
  depth: number;
  onReply?: (commentId: string, authorName: string) => void;
  onReaction?: (commentId: string, emoji: string) => void;
  onEdit?: (commentId: string, content: string) => void;
  onDelete?: (commentId: string) => void;
  currentUserId?: string;
}) {
  return (
    <div>
      <RepostCommentItem
        comment={comment}
        onReply={onReply}
        onReaction={onReaction}
        onEdit={onEdit}
        onDelete={onDelete}
        currentUserId={currentUserId}
      />
      {comment.replies && comment.replies.length > 0 && (
        <div
          className={
            depth < MAX_VISUAL_DEPTH
              ? "ml-8 mt-2 space-y-2 border-l-2 border-zinc-100 pl-3 dark:border-zinc-800"
              : "mt-2 space-y-2"
          }
        >
          {comment.replies.map((reply) => (
            <RepostCommentThread
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
              onReaction={onReaction}
              onEdit={onEdit}
              onDelete={onDelete}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function applyReactionOptimistic(
  comment: RepostCommentData,
  emoji: string,
  userId: string
): RepostCommentData {
  const reactions = [...(comment.reactions ?? [])];
  const group = reactions.find((r) => r.emoji === emoji);
  if (group) {
    if (group.userIds.includes(userId)) {
      const filtered = group.userIds.filter((id) => id !== userId);
      if (filtered.length === 0) {
        return { ...comment, reactions: reactions.filter((r) => r.emoji !== emoji) };
      }
      return {
        ...comment,
        reactions: reactions.map((r) =>
          r.emoji === emoji ? { ...r, userIds: filtered } : r
        ),
      };
    }
    return {
      ...comment,
      reactions: reactions.map((r) =>
        r.emoji === emoji ? { ...r, userIds: [...r.userIds, userId] } : r
      ),
    };
  }
  return { ...comment, reactions: [...reactions, { emoji, userIds: [userId] }] };
}

function RepostCommentItem({
  comment,
  onReply,
  onReaction,
  onEdit,
  onDelete,
  currentUserId,
}: {
  comment: RepostCommentData;
  onReply?: (commentId: string, authorName: string) => void;
  onReaction?: (commentId: string, emoji: string) => void;
  onEdit?: (commentId: string, content: string) => void;
  onDelete?: (commentId: string) => void;
  currentUserId?: string;
}) {
  const authorName =
    comment.author.displayName || comment.author.name || comment.author.username || "User";
  const avatarSrc = comment.author.avatar || comment.author.image;
  const reactions = comment.reactions ?? [];
  const isOwner = currentUserId === comment.author.id;

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [pickerSize, setPickerSize] = useState({ width: 350, height: 400 });

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [isEditing]);

  const openEmojiPicker = useCallback(() => {
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(350, vw - 16);
    const height = Math.min(400, vh - 100);
    setPickerSize({ width, height });

    if (emojiButtonRef.current) {
      const rect = emojiButtonRef.current.getBoundingClientRect();
      let top = rect.bottom + 4;
      let left = rect.left;

      left = Math.max(8, Math.min(left, vw - width - 8));
      if (top + height > vh - 8) {
        top = rect.top - height - 4;
      }
      top = Math.max(8, top);

      setPickerPos({ top, left });
    }
    setShowEmojiPicker(true);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    function handleClick(e: MouseEvent) {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker]);

  return (
    <div className="group/comment flex gap-2">
      <FramedAvatar src={avatarSrc} initial={authorName[0].toUpperCase()} size={30} frameId={comment.author.profileFrameId} referrerPolicy="no-referrer" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {comment.author.username ? (
              <Link href={`/${comment.author.username}`} className="hover:underline">
                {authorName}
              </Link>
            ) : (
              authorName
            )}
          </span>
          <span className="text-xs text-zinc-400">
            {timeAgo(new Date(comment.createdAt))}
          </span>
          {comment.editedAt && (
            <span className="text-xs text-zinc-400">(edited)</span>
          )}
        </div>

        {isEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = editContent.trim();
              if (trimmed && trimmed !== comment.content) {
                onEdit?.(comment.id, trimmed);
              }
              setIsEditing(false);
            }}
            className="mt-0.5 flex gap-1.5"
          >
            <input
              ref={editInputRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              maxLength={1000}
              className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-0.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="rounded bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setIsEditing(false); setEditContent(comment.content); }}
              className="rounded px-2 py-0.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Cancel
            </button>
          </form>
        ) : (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            <LinkifyText text={comment.content} />
          </p>
        )}

        {/* Reactions display */}
        {reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {reactions.map((reaction) => {
              const isReacted = currentUserId ? reaction.userIds.includes(currentUserId) : false;
              return (
                <button
                  key={reaction.emoji}
                  onClick={() => onReaction?.(comment.id, reaction.emoji)}
                  className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-xs transition-colors ${
                    isReacted
                      ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
                  }`}
                  aria-label={`${reaction.emoji} ${reaction.userIds.length}`}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {showDeleteConfirm && (
          <div className="mt-1 flex items-center gap-2 rounded bg-red-50 px-2 py-1 text-xs dark:bg-red-950/30">
            <span className="text-red-700 dark:text-red-300">Delete this comment?</span>
            <button
              onClick={() => { onDelete?.(comment.id); setShowDeleteConfirm(false); }}
              className="font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="mt-0.5 flex items-center gap-2">
          {onReply && (
            <button
              type="button"
              onClick={() => onReply(comment.id, authorName)}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Reply
            </button>
          )}
          {isOwner && onEdit && !isEditing && (
            <button
              type="button"
              onClick={() => { setEditContent(comment.content); setIsEditing(true); }}
              className="text-xs font-medium text-zinc-500 transition-opacity hover:text-zinc-700 sm:opacity-0 sm:group-hover/comment:opacity-100 dark:hover:text-zinc-300"
            >
              Edit
            </button>
          )}
          {isOwner && onDelete && !isEditing && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs font-medium text-zinc-500 transition-opacity hover:text-red-600 sm:opacity-0 sm:group-hover/comment:opacity-100 dark:hover:text-red-400"
            >
              Delete
            </button>
          )}
          {onReaction && (
            <div className="relative">
              <button
                ref={emojiButtonRef}
                onClick={openEmojiPicker}
                className="rounded p-0.5 text-zinc-400 transition-opacity hover:bg-zinc-100 hover:text-zinc-600 sm:opacity-0 sm:group-hover/comment:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                aria-label="Add reaction"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.536-4.464a.75.75 0 10-1.06-1.06 3.5 3.5 0 01-4.95 0 .75.75 0 00-1.06 1.06 5 5 0 007.07 0zM9 8.5c0 .828-.448 1.5-1 1.5s-1-.672-1-1.5S7.448 7 8 7s1 .672 1 1.5zm3 1.5c.552 0 1-.672 1-1.5S12.552 7 12 7s-1 .672-1 1.5.448 1.5 1 1.5z" clipRule="evenodd" />
                </svg>
              </button>
              {showEmojiPicker && pickerPos && createPortal(
                <div
                  ref={emojiPickerRef}
                  className="fixed z-50"
                  style={{ top: pickerPos.top, left: pickerPos.left }}
                >
                  <Suspense
                    fallback={
                      <div
                        className="flex items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-400 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                        style={{ width: pickerSize.width, height: pickerSize.height }}
                      >
                        Loading...
                      </div>
                    }
                  >
                    <LazyEmojiPicker
                      onEmojiClick={(emojiData) => {
                        onReaction(comment.id, emojiData.emoji);
                        setShowEmojiPicker(false);
                      }}
                      width={pickerSize.width}
                      height={pickerSize.height}
                      searchPlaceholder="Search emoji..."
                      previewConfig={{ showPreview: false }}
                    />
                  </Suspense>
                </div>,
                document.body
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
