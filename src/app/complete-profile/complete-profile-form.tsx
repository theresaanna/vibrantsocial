"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { completeProfile } from "./actions";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

interface CompleteProfileFormProps {
  needsUsername: boolean;
  needsEmail: boolean;
  needsDateOfBirth: boolean;
}

export function CompleteProfileForm({
  needsUsername,
  needsEmail,
  needsDateOfBirth,
}: CompleteProfileFormProps) {
  const [state, formAction, isPending] = useActionState(completeProfile, {
    success: false,
    message: "",
  });

  const [usernameValue, setUsernameValue] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!needsUsername) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = usernameValue.trim().toLowerCase();

    if (!trimmed) {
      setUsernameStatus("idle");
      return;
    }

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
  }, [usernameValue, needsUsername]);

  return (
    <form action={formAction} className="space-y-4">
      {needsUsername && (
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
            required
            minLength={3}
            maxLength={30}
            pattern="^[a-zA-Z0-9_]{3,30}$"
            value={usernameValue}
            onChange={(e) => setUsernameValue(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="your_username"
          />
          {usernameValue.trim() && (
            <div className="mt-1.5">
              {usernameStatus === "checking" && (
                <p className="text-xs text-zinc-400">
                  Checking availability...
                </p>
              )}
              {usernameStatus === "available" && (
                <p className="text-xs text-green-600">
                  vibrantsocial.com/{usernameValue.trim().toLowerCase()} is
                  available
                </p>
              )}
              {usernameStatus === "taken" && (
                <p className="text-xs text-red-600">
                  This username is already taken
                </p>
              )}
              {usernameStatus === "invalid" && (
                <p className="text-xs text-red-600">
                  3-30 characters, letters, numbers, and underscores only
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {needsEmail && (
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="you@example.com"
          />
        </div>
      )}

      {needsDateOfBirth && (
        <div>
          <label
            htmlFor="dateOfBirth"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Date of Birth
          </label>
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            required
            max={new Date().toISOString().split("T")[0]}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Used to verify you are at least 18 years old. Your birthday will not
            be displayed on your profile.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Saving..." : "Continue"}
      </button>

      {state.message && !state.success && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
    </form>
  );
}
