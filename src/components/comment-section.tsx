"use client";

import { useActionState } from "react";
import { createComment } from "@/app/feed/post-actions";
import { timeAgo } from "@/lib/time";
import Link from "next/link";

interface CommentAuthor {
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
  author: CommentAuthor;
}

interface CommentSectionProps {
  postId: string;
  comments: CommentData[];
  phoneVerified: boolean;
}

export function CommentSection({
  postId,
  comments,
  phoneVerified,
}: CommentSectionProps) {
  const [state, formAction, isPending] = useActionState(createComment, {
    success: false,
    message: "",
  });

  return (
    <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
      {comments.length > 0 && (
        <div className="mb-3 space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                {(
                  comment.author.displayName ||
                  comment.author.name ||
                  "?"
                )[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {comment.author.username ? (
                      <Link
                        href={`/${comment.author.username}`}
                        className="hover:underline"
                      >
                        {comment.author.displayName || comment.author.name}
                      </Link>
                    ) : (
                      comment.author.displayName || comment.author.name
                    )}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {timeAgo(new Date(comment.createdAt))}
                  </span>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {phoneVerified ? (
        <form action={formAction} className="flex gap-2">
          <input type="hidden" name="postId" value={postId} />
          <input
            name="content"
            type="text"
            placeholder="Write a comment..."
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
