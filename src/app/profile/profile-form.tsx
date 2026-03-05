"use client";

import { useActionState } from "react";
import { useSession } from "next-auth/react";
import { updateProfile } from "./actions";

interface ProfileFormProps {
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    bio: string | null;
  };
}

interface ProfileState {
  success: boolean;
  message: string;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const { update } = useSession();
  const [state, formAction, isPending] = useActionState(
    async (prevState: ProfileState, formData: FormData) => {
      const result = await updateProfile(prevState, formData);
      if (result.success) {
        await update({
          user: {
            username: (formData.get("username") as string) || null,
            displayName: (formData.get("displayName") as string) || null,
            bio: (formData.get("bio") as string) || null,
          },
        });
      }
      return result;
    },
    { success: false, message: "" }
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          defaultValue={user.username ?? ""}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="your_username"
        />
      </div>

      <div>
        <label
          htmlFor="displayName"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Display Name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={user.displayName ?? ""}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div>
        <label
          htmlFor="bio"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          defaultValue={user.bio ?? ""}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="Tell us about yourself..."
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Saving..." : "Save Profile"}
      </button>

      {state.message && (
        <p
          className={`text-sm ${
            state.success ? "text-green-600" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
