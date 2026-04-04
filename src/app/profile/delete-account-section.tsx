"use client";

import { useActionState, useState } from "react";
import { signOut } from "next-auth/react";
import { deleteAccount } from "./actions";

interface DeleteAccountSectionProps {
  username: string | null;
}

interface ProfileState {
  success: boolean;
  message: string;
}

export function DeleteAccountSection({ username }: DeleteAccountSectionProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const [deleteState, deleteFormAction, isDeleting] = useActionState(
    async (prevState: ProfileState, formData: FormData) => {
      const result = await deleteAccount(prevState, formData);
      if (result.success) {
        await signOut({ redirectTo: "/" });
      }
      return result;
    },
    { success: false, message: "" }
  );

  return (
    <div className="rounded-lg border border-red-200 p-4 dark:border-red-900/50">
      <p className="text-base font-semibold text-red-600 dark:text-red-400">
        Delete Account
      </p>
      {!showDeleteConfirm ? (
        <>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Permanently delete your account and all associated data.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            data-testid="delete-account-button"
          >
            Delete Account
          </button>
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              This action is permanent and cannot be undone.
            </p>
            <p className="mt-1 text-xs text-red-700 dark:text-red-400">
              Your posts, comments, messages, and all other data will be permanently deleted.
              If someone quoted your post, the quote will remain but your original post will
              be replaced with a &ldquo;user deleted&rdquo; notice.
            </p>
          </div>
          <form action={deleteFormAction}>
            <label
              htmlFor="deleteConfirmation"
              className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200"
            >
              Type <span className="font-mono text-red-600 dark:text-red-400">delete {username}</span> to confirm
            </label>
            <input
              id="deleteConfirmation"
              name="confirmation"
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder={`delete ${username}`}
              autoComplete="off"
              data-testid="delete-confirmation-input"
            />
            {deleteState.message && !deleteState.success && (
              <p className="mt-1 text-xs text-red-600">{deleteState.message}</p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={
                  isDeleting ||
                  deleteConfirmation.trim().toLowerCase() !==
                    `delete ${username}`.toLowerCase()
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                data-testid="delete-account-confirm"
              >
                {isDeleting ? "Deleting..." : "Delete My Account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmation("");
                }}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
