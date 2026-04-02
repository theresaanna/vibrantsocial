"use client";

import { useActionState, useState } from "react";
import { updateLinksPage } from "./actions";

interface LinkEntry {
  id: string;
  title: string;
  url: string;
}

interface LinksFormProps {
  enabled: boolean;
  bio: string;
  links: LinkEntry[];
  username: string | null;
  sensitiveLinks: boolean;
}

export function LinksForm({ enabled, bio, links: initialLinks, username, sensitiveLinks }: LinksFormProps) {
  const [links, setLinks] = useState<LinkEntry[]>(
    initialLinks.length > 0
      ? initialLinks
      : [{ id: crypto.randomUUID(), title: "", url: "" }]
  );

  const [state, formAction, isPending] = useActionState(updateLinksPage, {
    success: false,
    message: "",
  });

  function addLink() {
    setLinks((prev) => [...prev, { id: crypto.randomUUID(), title: "", url: "" }]);
  }

  function removeLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLink(id: string, field: "title" | "url", value: string) {
    setLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Enable Links Page
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {username
              ? `Available at links.vibrantsocial.app/${username}`
              : "Set a username first to enable your links page"}
          </p>
        </div>
        <input
          type="checkbox"
          name="linksPageEnabled"
          defaultChecked={enabled}
          disabled={!username}
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
        />
      </div>

      {/* Sensitive link safety */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Sensitive link safety
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Hide links when viewed in social media app browsers (Instagram,
            TikTok, etc.). Use this if your links may violate app content
            policies.
          </p>
        </div>
        <input
          type="checkbox"
          name="linksPageSensitiveLinks"
          defaultChecked={sensitiveLinks}
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
          data-testid="sensitive-links-toggle"
        />
      </div>

      {/* Bio */}
      <div>
        <label
          htmlFor="linksPageBio"
          className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Bio
        </label>
        <textarea
          id="linksPageBio"
          name="linksPageBio"
          defaultValue={bio}
          maxLength={300}
          rows={3}
          placeholder="A short bio for your links page..."
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* Links */}
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Links
        </p>
        <div className="space-y-3">
          {links.map((link, i) => (
            <div
              key={link.id}
              className="flex items-start gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
              data-testid="link-entry"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  name="linkTitle"
                  value={link.title}
                  onChange={(e) => updateLink(link.id, "title", e.target.value)}
                  placeholder="Link text"
                  maxLength={100}
                  className="min-w-0 flex-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <input
                  type="url"
                  name="linkUrl"
                  value={link.url}
                  onChange={(e) => updateLink(link.id, "url", e.target.value)}
                  placeholder="https://..."
                  className="min-w-0 flex-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <button
                type="button"
                onClick={() => removeLink(link.id)}
                className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-700"
                aria-label={`Remove link ${i + 1}`}
                data-testid="remove-link-btn"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addLink}
          className="mt-3 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
          data-testid="add-link-btn"
        >
          + Add Link
        </button>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        {state.message && (
          <p
            className={`text-sm ${state.success ? "text-green-600" : "text-red-600"}`}
            data-testid="links-form-message"
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
