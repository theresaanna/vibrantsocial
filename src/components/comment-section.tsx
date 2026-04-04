"use client";

import { useActionState, useState, useRef, useEffect, lazy, Suspense, useCallback } from "react";
import { createPortal } from "react-dom";
import { createComment, fetchComments, toggleCommentReaction, editComment, deleteComment } from "@/app/feed/post-actions";
import { timeAgo } from "@/lib/time";
import { useComments, type CommentData, type ReactionGroup } from "@/hooks/use-comments";
import Link from "next/link";
import { LinkifyText } from "@/components/chat/linkify-text";
import { LinkPreviewCard } from "@/components/link-preview-card";
import { ImageOverlay } from "@/components/image-overlay";
import { FramedAvatar } from "@/components/framed-avatar";
import { ReportModal } from "@/components/report-modal";
import { StyledName } from "@/components/styled-name";
import { MentionInput, type MentionInputHandle } from "@/components/mention-input";

const LazyEmojiPicker = lazy(() => import("emoji-picker-react"));

interface CommentSectionProps {
  postId: string;
  comments?: CommentData[];
  phoneVerified: boolean;
  isAuthenticated?: boolean;
  highlightCommentId?: string | null;
  onCommentCountChange?: (count: number) => void;
  currentUserId?: string;
}

export function CommentSection({
  postId,
  comments: initialComments,
  phoneVerified,
  isAuthenticated = true,
  highlightCommentId,
  onCommentCountChange,
  currentUserId,
}: CommentSectionProps) {
  const [loadedComments, setLoadedComments] = useState<CommentData[] | null>(
    initialComments ?? null
  );
  const [loading, setLoading] = useState(!initialComments);

  // Lazy-load comments when not provided (feed view)
  useEffect(() => {
    if (initialComments) return;
    let cancelled = false;
    fetchComments(postId).then((data) => {
      if (!cancelled) {
        setLoadedComments(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [postId, initialComments]);

  const { comments, setComments } = useComments(postId, loadedComments ?? [], currentUserId);

  // Report comment count changes to parent (PostCard)
  useEffect(() => {
    if (!onCommentCountChange) return;
    function countAll(list: CommentData[]): number {
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
  const inputRef = useRef<MentionInputHandle>(null);
  const hasScrolled = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [state, formAction, isPending] = useActionState(
    async (prevState: { success: boolean; message: string }, formData: FormData) => {
      const result = await createComment(prevState, formData);
      if (result.success) {
        // Add comment to list immediately (don't wait for Ably)
        if (result.comment) {
          const newComment: CommentData = {
            ...result.comment,
            imageUrl: result.comment.imageUrl,
            createdAt: new Date(result.comment.createdAt),
            replies: [],
          };
          setComments((prev) => {
            // Avoid duplicate if Ably message already arrived
            const exists = prev.some((c) => c.id === newComment.id) ||
              prev.some((c) => c.replies?.some((r) => r.id === newComment.id));
            if (exists) return prev;
            if (newComment.parentId) {
              // Add as reply under parent
              function addReply(list: CommentData[]): CommentData[] {
                return list.map((c) => {
                  if (c.id === newComment.parentId) {
                    return { ...c, replies: [...(c.replies || []), newComment] };
                  }
                  if (c.replies) return { ...c, replies: addReply(c.replies) };
                  return c;
                });
              }
              return addReply(prev);
            }
            return [...prev, newComment];
          });
        }
        setReplyingTo(null);
        setPendingImageUrl(null);
        inputRef.current?.clear();
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

  // Scroll to highlighted comment on mount
  useEffect(() => {
    if (!highlightCommentId || hasScrolled.current) return;
    // Use a small delay to ensure DOM is rendered
    const timer = setTimeout(() => {
      const el = document.getElementById(`comment-${highlightCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        hasScrolled.current = true;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [highlightCommentId, comments]);

  const handleReaction = useCallback(async (commentId: string, emoji: string) => {
    if (!currentUserId) return;

    // Recursive optimistic update
    function updateDeep(list: CommentData[]): CommentData[] {
      return list.map((c) => {
        if (c.id === commentId) return applyReactionOptimistic(c, emoji, currentUserId!);
        if (c.replies) return { ...c, replies: updateDeep(c.replies) };
        return c;
      });
    }
    setComments(updateDeep);

    await toggleCommentReaction({ commentId, emoji });
  }, [currentUserId, setComments]);

  const handleEdit = useCallback(async (commentId: string, content: string) => {
    // Recursive optimistic update
    function updateDeep(list: CommentData[]): CommentData[] {
      return list.map((c) => {
        if (c.id === commentId) return { ...c, content, editedAt: new Date() };
        if (c.replies) return { ...c, replies: updateDeep(c.replies) };
        return c;
      });
    }
    setComments(updateDeep);
    await editComment({ commentId, content });
  }, [setComments]);

  const handleDelete = useCallback(async (commentId: string, _parentId?: string | null) => {
    // Recursive optimistic delete
    function removeDeep(list: CommentData[]): CommentData[] {
      return list
        .filter((c) => c.id !== commentId)
        .map((c) => c.replies ? { ...c, replies: removeDeep(c.replies) } : c);
    }
    setComments(removeDeep);
    await deleteComment({ commentId });
  }, [setComments]);

  if (loading) {
    return (
      <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <p className="text-sm text-zinc-400">Loading comments...</p>
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
      {comments.length > 0 && (
        <div className="mb-3 space-y-3">
          {comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              depth={0}
              onReply={isAuthenticated && phoneVerified ? (id, name) => setReplyingTo({ id, name }) : undefined}
              highlightCommentId={highlightCommentId}
              onReaction={isAuthenticated ? handleReaction : undefined}
              onEdit={handleEdit}
              onDelete={handleDelete}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {!isAuthenticated ? (
        <p className="text-sm text-zinc-500" data-testid="sign-in-to-comment">
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
          <form action={formAction} className="flex flex-col gap-2">
            <input type="hidden" name="postId" value={postId} />
            {replyingTo && (
              <input type="hidden" name="parentId" value={replyingTo.id} />
            )}
            {pendingImageUrl && (
              <input type="hidden" name="imageUrl" value={pendingImageUrl} />
            )}
            {pendingImageUrl && (
              <div className="relative inline-block" data-testid="comment-image-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingImageUrl}
                  alt="Attachment"
                  className="max-h-48 rounded-lg border border-zinc-200 dark:border-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => setPendingImageUrl(null)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  aria-label="Remove image"
                  data-testid="comment-image-remove"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div className="flex gap-2 sm:flex-row">
              <MentionInput
                ref={inputRef}
                name="content"
                placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : "Write a comment..."}
                maxLength={1000}
                className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
                className="hidden"
                data-testid="comment-image-input"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    const res = await fetch("/api/upload", { method: "POST", body: formData });
                    if (!res.ok) {
                      const data = await res.json();
                      throw new Error(data.error || "Upload failed");
                    }
                    const { url } = await res.json();
                    setPendingImageUrl(url);
                  } catch {
                    // Upload failed — user can retry
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !!pendingImageUrl}
                className="shrink-0 self-end rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                aria-label="Attach image"
                data-testid="comment-image-button"
              >
                {uploading ? (
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                  </svg>
                )}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="shrink-0 self-end rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isPending ? "..." : "Reply"}
              </button>
            </div>
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

function CommentThread({
  comment,
  depth,
  onReply,
  highlightCommentId,
  onReaction,
  onEdit,
  onDelete,
  currentUserId,
}: {
  comment: CommentData;
  depth: number;
  onReply?: (commentId: string, authorName: string) => void;
  highlightCommentId?: string | null;
  onReaction?: (commentId: string, emoji: string) => void;
  onEdit?: (commentId: string, content: string) => void;
  onDelete?: (commentId: string, parentId?: string | null) => void;
  currentUserId?: string;
}) {
  return (
    <div id={`comment-${comment.id}`}>
      <CommentItem
        comment={comment}
        parentId={comment.parentId ?? undefined}
        onReply={onReply}
        isHighlighted={highlightCommentId === comment.id}
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
            <CommentThread
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
              highlightCommentId={highlightCommentId}
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
  comment: CommentData,
  emoji: string,
  userId: string
): CommentData {
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

function CommentItem({
  comment,
  parentId,
  onReply,
  isHighlighted,
  onReaction,
  onEdit,
  onDelete,
  currentUserId,
}: {
  comment: CommentData;
  parentId?: string;
  onReply?: (commentId: string, authorName: string) => void;
  isHighlighted?: boolean;
  onReaction?: (commentId: string, emoji: string) => void;
  onEdit?: (commentId: string, content: string) => void;
  onDelete?: (commentId: string, parentId?: string | null) => void;
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
  const [showImageOverlay, setShowImageOverlay] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const [showReportModal, setShowReportModal] = useState(false);
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

  // Close emoji picker on outside click
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
    <div
      className={`group/comment flex gap-2 ${
        isHighlighted
          ? "-mx-2 rounded-lg bg-blue-50 px-2 py-1.5 dark:bg-blue-950/30"
          : ""
      }`}
    >
      <FramedAvatar src={avatarSrc} initial={authorName[0].toUpperCase()} size={30} frameId={comment.author.profileFrameId} referrerPolicy="no-referrer" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {comment.author.username ? (
              <Link
                href={`/${comment.author.username}`}
                className="hover:underline"
              >
                <StyledName fontId={comment.author.usernameFont}>{authorName}</StyledName>
              </Link>
            ) : (
              <StyledName fontId={comment.author.usernameFont}>{authorName}</StyledName>
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
              data-testid="comment-edit-input"
            />
            <button
              type="submit"
              className="rounded bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              data-testid="comment-edit-save"
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
          <>
            {comment.content && (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                <LinkifyText text={comment.content} />
              </p>
            )}
            {comment.imageUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={comment.imageUrl}
                  alt="Comment image"
                  className="mt-1 cursor-zoom-in rounded-lg"
                  style={{ maxWidth: "1000px", maxHeight: "1000px" }}
                  onClick={() => setShowImageOverlay(true)}
                  data-testid="comment-image"
                />
                {showImageOverlay && (
                  <ImageOverlay
                    src={comment.imageUrl}
                    alt="Comment image"
                    onClose={() => setShowImageOverlay(false)}
                  />
                )}
              </>
            )}
            {comment.content && <CommentLinkPreview text={comment.content} />}
          </>
        )}

        {/* Reactions display */}
        {reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {reactions.map((reaction: ReactionGroup) => {
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
                  data-testid="comment-reaction-badge"
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
              onClick={() => { onDelete?.(comment.id, parentId); setShowDeleteConfirm(false); }}
              className="font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
              data-testid="comment-delete-confirm"
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
              className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              data-testid="comment-edit-button"
            >
              Edit
            </button>
          )}
          {isOwner && onDelete && !isEditing && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs font-medium text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
              data-testid="comment-delete-button"
            >
              Delete
            </button>
          )}
          {onReaction && (
            <div className="relative">
              <button
                ref={emojiButtonRef}
                onClick={openEmojiPicker}
                className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                aria-label="Add reaction"
                data-testid="comment-add-reaction"
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
                  data-testid="comment-emoji-picker"
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
          {!isOwner && currentUserId && (
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="text-xs font-medium text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
              data-testid="comment-report-button"
            >
              Report
            </button>
          )}
        </div>
      </div>
      <ReportModal
        contentType="comment"
        contentId={comment.id}
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />
    </div>
  );
}

const YOUTUBE_RE = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch|youtu\.be\/)/i;
const COMMENT_URL_RE = /https?:\/\/[^\s)]+/;

function CommentLinkPreview({ text }: { text: string }) {
  const match = text.match(COMMENT_URL_RE);
  if (!match || YOUTUBE_RE.test(match[0])) return null;
  return <LinkPreviewCard url={match[0]} />;
}
