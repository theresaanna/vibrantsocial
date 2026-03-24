"use client";

import { useState, useRef, useActionState } from "react";
import { addUserToMultipleLists, createList } from "@/app/lists/actions";

interface ListWithMembership {
  id: string;
  name: string;
  isMember: boolean;
}

interface AddToListButtonProps {
  targetUserId: string;
  lists: ListWithMembership[];
}

export function AddToListButton({ targetUserId, lists: initialLists }: AddToListButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [lists, setLists] = useState(initialLists);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialLists.filter((l) => l.isMember).map((l) => l.id))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [createState, createAction, isCreating] = useActionState(createList, {
    success: false,
    message: "",
  });

  const handleOpen = () => {
    dialogRef.current?.showModal();
  };

  const handleClose = () => {
    dialogRef.current?.close();
  };

  const handleToggle = (listId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await addUserToMultipleLists([...selectedIds], targetUserId);
      // Update local state to reflect changes
      setLists((prev) =>
        prev.map((l) => ({
          ...l,
          isMember: selectedIds.has(l.id),
        }))
      );
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  // When a new list is created, add it to our local state
  const handleCreateList = async (formData: FormData) => {
    createAction(formData);
  };

  const createSuccess = createState.success;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-semibold whitespace-nowrap text-zinc-700 transition-all hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50 dark:border-zinc-600 dark:bg-transparent dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
        title="Add to list"
      >
        <svg className="-ml-0.5 mr-1 inline-block h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        Lists
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-sm rounded-2xl bg-white p-0 shadow-xl backdrop:bg-black/50 dark:bg-zinc-900"
        onClick={(e) => {
          if (e.target === dialogRef.current) handleClose();
        }}
      >
        <div className="p-6">
          <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Add to Lists
          </h2>

          {lists.length === 0 && !createSuccess ? (
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              You don&apos;t have any lists yet. Create one below.
            </p>
          ) : (
            <div className="mb-4 max-h-60 space-y-2 overflow-y-auto">
              {lists.map((list) => (
                <label
                  key={list.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(list.id)}
                    onChange={() => handleToggle(list.id)}
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
                  />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {list.name}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Inline create list form */}
          <form action={handleCreateList} className="mb-4 flex gap-2">
            <input
              type="text"
              name="name"
              placeholder="New list name..."
              maxLength={50}
              required
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
            >
              {isCreating ? "..." : "Create"}
            </button>
          </form>

          {createState.message && !createState.success && (
            <p className="mb-3 text-xs text-red-500">{createState.message}</p>
          )}

          {createSuccess && (
            <p className="mb-3 text-xs text-green-600 dark:text-green-400">
              List created successfully.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
