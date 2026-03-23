"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createList, deleteList } from "./actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useState } from "react";

interface ListItem {
  id: string;
  name: string;
  _count: { members: number };
}

function DeleteListButton({ listId }: { listId: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [, formAction, isPending] = useActionState(deleteList, {
    success: false,
    message: "",
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={isPending}
        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-400"
      >
        {isPending ? "Deleting..." : "Delete"}
      </button>
      <ConfirmDialog
        open={showConfirm}
        title="Delete list?"
        message="This will permanently delete this list and remove all members. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setShowConfirm(false);
          const form = document.getElementById(`delete-list-${listId}`) as HTMLFormElement;
          if (form) form.requestSubmit();
        }}
        onCancel={() => setShowConfirm(false)}
      />
      <form id={`delete-list-${listId}`} action={formAction} className="hidden">
        <input type="hidden" name="listId" value={listId} />
      </form>
    </>
  );
}

export function ListsPageClient({ lists }: { lists: ListItem[] }) {
  const [createState, createAction, isCreating] = useActionState(createList, {
    success: false,
    message: "",
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-600">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Lists</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Create lists to organize your feed
          </p>
        </div>
      </div>

      {/* Create list form */}
      <form action={createAction} className="mb-6 flex gap-2">
        <input
          type="text"
          name="name"
          placeholder="New list name..."
          maxLength={50}
          required
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <button
          type="submit"
          disabled={isCreating}
          className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
        >
          {isCreating ? "Creating..." : "Create"}
        </button>
      </form>

      {createState.message && !createState.success && (
        <p className="mb-4 text-sm text-red-500">{createState.message}</p>
      )}

      {/* Lists */}
      {lists.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">No lists yet.</p>
          <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
            Create a list above to start organizing your feed.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map((list) => (
            <div
              key={list.id}
              className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-900"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/lists/${list.id}`}
                  className="block text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  {list.name}
                </Link>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {list._count.members} {list._count.members === 1 ? "member" : "members"}
                </span>
              </div>
              <Link
                href={`/feed?list=${list.id}`}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-indigo-800 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400"
              >
                View Feed
              </Link>
              <DeleteListButton listId={list.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
