"use client";

import { useActionState, useState, useEffect, useRef } from "react";
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

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export function ProfileForm({ user }: ProfileFormProps) {
  const { update } = useSession();
  const [usernameValue, setUsernameValue] = useState(user.username ?? "");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = usernameValue.trim().toLowerCase();

    // If empty, reset
    if (!trimmed) {
      setUsernameStatus("idle");
      return;
    }

    // If same as current username, it's fine
    if (trimmed === user.username?.toLowerCase()) {
      setUsernameStatus("available");
      return;
    }

    // Validate format locally first
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmed)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/username-check?username=${encodeURIComponent(trimmed)}`
        );
        const data = await res.json();
        setUsernameStatus(data.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [usernameValue, user.username]);

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
          value={usernameValue}
          onChange={(e) => setUsernameValue(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="your_username"
        />
        {usernameStatus === "checking" && (
          <p className="mt-1 text-xs text-zinc-400">Checking availability...</p>
        )}
        {usernameStatus === "available" && (
          <p className="mt-1 text-xs text-green-600">Username is available</p>
        )}
        {usernameStatus === "taken" && (
          <p className="mt-1 text-xs text-red-600">Username is already taken</p>
        )}
        {usernameStatus === "invalid" && (
          <p className="mt-1 text-xs text-red-600">
            3–30 characters, letters, numbers, and underscores only
          </p>
        )}
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
        disabled={isPending || usernameStatus === "taken"}
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
