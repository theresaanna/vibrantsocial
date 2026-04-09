"use client";

import { useActionState } from "react";
import { submitSupportRequest } from "./actions";

const SUBJECT_OPTIONS = [
  { value: "", label: "Select a subject..." },
  { value: "bug_report", label: "Bug Report" },
  { value: "appeal_content_warning", label: "Appeal Content Warning" },
  { value: "abuse_report", label: "Abuse Report" },
  { value: "feature_request", label: "Feature Request" },
  { value: "feedback", label: "Feedback" },
  { value: "other", label: "Other" },
];

export function SupportForm({
  username,
  email,
}: {
  username: string;
  email: string;
}) {
  const [state, formAction, isPending] = useActionState(
    submitSupportRequest,
    { success: false, message: "" }
  );

  if (state.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Username
        </label>
        <input
          type="text"
          value={username}
          disabled
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email
        </label>
        <input
          type="email"
          value={email}
          disabled
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        />
      </div>

      <div>
        <label
          htmlFor="subject"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Subject
        </label>
        <select
          id="subject"
          name="subject"
          required
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {SUBJECT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="body"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Message
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={6}
          maxLength={5000}
          placeholder="Describe your issue or feedback..."
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {state.message && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
