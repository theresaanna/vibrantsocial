"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createList, deleteList } from "./actions";
import { ShareListButton } from "@/components/share-list-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useState } from "react";

interface ListItem {
  id: string;
  name: string;
  _count: { members: number };
}

interface CollaboratingListItem extends ListItem {
  owner: {
    username: string | null;
    displayName: string | null;
    name: string | null;
  };
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

export function ListsPageClient({ lists, collaboratingLists }: { lists: ListItem[]; collaboratingLists: CollaboratingListItem[] }) {
  const [createState, createAction, isCreating] = useActionState(createList, {
    success: false,
    message: "",
  });

  return (
    <div>
      <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
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
          <div className="py-8 text-center">
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
                className="flex items-center gap-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800"
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
                <ShareListButton listId={list.id} listName={list.name} />
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

        {/* Collaborating lists */}
        {collaboratingLists.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Collaborating
            </h2>
            <div className="space-y-2">
              {collaboratingLists.map((list) => {
                const ownerName = list.owner.displayName ?? list.owner.username ?? list.owner.name ?? "Unknown";
                return (
                  <div
                    key={list.id}
                    className="flex items-center gap-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800"
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
                        {" · "}by {ownerName}
                      </span>
                    </div>
                    <ShareListButton listId={list.id} listName={list.name} />
                    <Link
                      href={`/feed?list=${list.id}`}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-indigo-800 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400"
                    >
                      View Feed
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
