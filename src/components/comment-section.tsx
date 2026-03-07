"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { createComment, fetchComments } from "@/app/feed/post-actions";
import { timeAgo } from "@/lib/time";
import { useComments, type CommentData } from "@/hooks/use-comments";
import Link from "next/link";

/**
 * Renders comment text, converting @username mentions into clickable profile links.
 */
function renderCommentContent(text: string) {
  const parts = text.split(/(@[a-zA-Z0-9_]{3,30})/g);
  return parts.map((part, i) => {
    if (/^@[a-zA-Z0-9_]{3,30}$/.test(part)) {
      const username = part.slice(1);
      return (
        <Link
          key={i}
          href={`/${username}`}
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {part}
        </Link>
      );
    }
    return part;
  });
}

interface CommentSectionProps {
  postId: string;
  comments?: CommentData[];
  phoneVerified: boolean;
  highlightCommentId?: string | null;
}

export function CommentSection({
  postId,
  comments: initialComments,
  phoneVerified,
  highlightCommentId,
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

  const { comments } = useComments(postId, loadedComments ?? []);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasScrolled = useRef(false);

  const [state, formAction, isPending] = useActionState(
    async (prevState: { success: boolean; message: string }, formData: FormData) => {
      const result = await createComment(prevState, formData);
      if (result.success) {
        setReplyingTo(null);
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
            <div key={comment.id} id={`comment-${comment.id}`}>
              <CommentItem
                comment={comment}
                onReply={phoneVerified ? (id, name) => setReplyingTo({ id, name }) : undefined}
                isHighlighted={highlightCommentId === comment.id}
              />
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-8 mt-2 space-y-2 border-l-2 border-zinc-100 pl-3 dark:border-zinc-800">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} id={`comment-${reply.id}`}>
                      <CommentItem
                        comment={reply}
                        onReply={phoneVerified ? (id, name) => setReplyingTo({ id, name }) : undefined}
                        isHighlighted={highlightCommentId === reply.id}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {phoneVerified ? (
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
            <input type="hidden" name="postId" value={postId} />
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

function CommentItem({
  comment,
  onReply,
  isHighlighted,
}: {
  comment: CommentData;
  onReply?: (commentId: string, authorName: string) => void;
  isHighlighted?: boolean;
}) {
  const authorName =
    comment.author.displayName || comment.author.name || "User";
  const avatarSrc = comment.author.avatar || comment.author.image;

  return (
    <div
      className={`flex gap-2 ${
        isHighlighted
          ? "-mx-2 rounded-lg bg-blue-50 px-2 py-1.5 dark:bg-blue-950/30"
          : ""
      }`}
    >
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt=""
          referrerPolicy="no-referrer"
          className="h-6 w-6 shrink-0 rounded-full"
        />
      ) : (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
          {authorName[0].toUpperCase()}
        </div>
      )}
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
          {renderCommentContent(comment.content)}
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
