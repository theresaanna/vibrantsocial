"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EditorContent } from "@/components/editor/EditorContent";
import {
  updatePostSchedule,
  deleteScheduledPost,
  publishScheduledPostNow,
} from "./schedule-actions";

interface ScheduledPost {
  id: string;
  content: string;
  slug: string | null;
  scheduledFor: string;
  isSensitive: boolean;
  isNsfw: boolean;
  isGraphicNudity: boolean;
  isCloseFriendsOnly: boolean;
  hasCustomAudience: boolean;
  isLoggedInOnly: boolean;
  hideLinkPreview: boolean;
  tags: { tag: { name: string } }[];
}

export function ScheduledPostsList({ posts }: { posts: ScheduledPost[] }) {
  if (posts.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Scheduled Posts ({posts.length})
      </h2>
      <div className="space-y-3">
        {posts.map((post) => (
          <ScheduledPostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}

function ScheduledPostCard({ post }: { post: ScheduledPost }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState(
    new Date(post.scheduledFor).toISOString().slice(0, 16)
  );
  const [error, setError] = useState("");

  const scheduledDate = new Date(post.scheduledFor);
  const minDate = new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16);

  function handleUpdateSchedule() {
    setError("");
    startTransition(async () => {
      const result = await updatePostSchedule(post.id, new Date(newSchedule).toISOString());
      if (result.success) {
        setEditingSchedule(false);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  function handleDelete() {
    if (!confirm("Delete this scheduled post?")) return;
    setError("");
    startTransition(async () => {
      const result = await deleteScheduledPost(post.id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  function handlePublishNow() {
    setError("");
    startTransition(async () => {
      const result = await publishScheduledPostNow(post.id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  const flags = [
    post.isCloseFriendsOnly && "Close Friends",
    post.hasCustomAudience && "Custom Audience",
    post.isLoggedInOnly && "Logged-in Only",
    post.isNsfw && "NSFW",
    post.isSensitive && "Sensitive",
    post.isGraphicNudity && "Graphic/Explicit",
  ].filter(Boolean);

  return (
    <div
      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      data-testid="scheduled-post-card"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 6v6l4 2" />
          </svg>
          <time dateTime={scheduledDate.toISOString()}>
            {scheduledDate.toLocaleString()}
          </time>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePublishNow}
            disabled={isPending}
            className="rounded-md px-2 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
            title="Publish now"
            data-testid="publish-now-button"
          >
            Publish Now
          </button>
          <button
            type="button"
            onClick={() => setEditingSchedule(!editingSchedule)}
            disabled={isPending}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            title="Edit schedule"
            data-testid="edit-schedule-button"
          >
            Reschedule
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
            title="Delete scheduled post"
            data-testid="delete-scheduled-button"
          >
            Delete
          </button>
        </div>
      </div>
      {editingSchedule && (
        <div className="mb-3 flex items-center gap-2">
          <input
            type="datetime-local"
            value={newSchedule}
            onChange={(e) => setNewSchedule(e.target.value)}
            min={minDate}
            className="flex-1 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500"
            data-testid="reschedule-datetime"
          />
          <button
            type="button"
            onClick={handleUpdateSchedule}
            disabled={isPending}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            data-testid="save-schedule-button"
          >
            Save
          </button>
        </div>
      )}
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="prose prose-sm max-h-40 overflow-hidden dark:prose-invert">
        <EditorContent content={post.content} />
      </div>
      {(flags.length > 0 || post.tags.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {flags.map((flag) => (
            <span
              key={flag}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {flag}
            </span>
          ))}
          {post.tags.map((t) => (
            <span
              key={t.tag.name}
              className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
            >
              #{t.tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
