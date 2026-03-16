"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { createRepostComment, fetchRepostComments } from "@/app/feed/post-actions";
import { timeAgo } from "@/lib/time";
import Link from "next/link";
import { LinkifyText } from "@/components/chat/linkify-text";
import { FramedAvatar } from "@/components/framed-avatar";

interface CommentAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatar: string | null;
  profileFrameId: string | null;
}

interface RepostCommentData {
  id: string;
  content: string;
  createdAt: Date | string;
  author: CommentAuthor;
  replies?: RepostCommentData[];
}

interface RepostCommentSectionProps {
  repostId: string;
  comments?: RepostCommentData[];
  phoneVerified: boolean;
  isAuthenticated?: boolean;
  onCommentCountChange?: (count: number) => void;
}

export function RepostCommentSection({
  repostId,
  comments: initialComments,
  phoneVerified,
  isAuthenticated = true,
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
          <form action={formAction} className="flex gap-2">
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
              className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
}: {
  comment: RepostCommentData;
  depth: number;
  onReply?: (commentId: string, authorName: string) => void;
}) {
  return (
    <div>
      <RepostCommentItem comment={comment} onReply={onReply} />
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RepostCommentItem({
  comment,
  onReply,
}: {
  comment: RepostCommentData;
  onReply?: (commentId: string, authorName: string) => void;
}) {
  const authorName =
    comment.author.displayName || comment.author.name || "User";
  const avatarSrc = comment.author.avatar || comment.author.image;

  return (
    <div className="flex gap-2">
      <FramedAvatar src={avatarSrc} initial={authorName[0].toUpperCase()} size={30} frameId={comment.author.profileFrameId} referrerPolicy="no-referrer" />
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {comment.author.username ? (
              <Link
                href={`/${comment.author.username}`}
                className="hover:underline"
              >
                {authorName}
              </Link>
            ) : (
              authorName
            )}
          </span>
          <span className="text-xs text-zinc-400">
            {timeAgo(new Date(comment.createdAt))}
          </span>
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          <LinkifyText text={comment.content} />
        </p>
        {onReply && (
          <button
            type="button"
            onClick={() => onReply(comment.id, authorName)}
            className="mt-0.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Reply
          </button>
        )}
      </div>
    </div>
  );
}
