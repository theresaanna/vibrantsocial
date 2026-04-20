"use client";

import { useState, useTransition } from "react";
import {
  findUserForAdmin,
  unlinkSocialAccount,
  type AdminUserLookup,
} from "./actions";

/**
 * Admin "Accounts" tab: look up a user by username or email, then view
 * and unlink their OAuth (Google / Discord / …) sign-in accounts.
 *
 * The tab is intentionally search-driven rather than list-everyone —
 * mass-listing every user's OAuth accounts isn't useful and would be
 * bulky (every user has at least one Account row). Admins come here
 * because support handed them a specific username.
 */
export function AccountsTab() {
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<AdminUserLookup | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();

  function search(form: FormData) {
    const q = (form.get("q") as string | null)?.trim() ?? "";
    if (!q) return;
    setSearchError(null);
    startSearch(async () => {
      try {
        const result = await findUserForAdmin(q);
        setUser(result);
        setNotFound(result === null);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Search failed");
        setUser(null);
        setNotFound(false);
      }
    });
  }

  async function refreshCurrent() {
    if (!user) return;
    // Re-hit the lookup so the accounts list reflects the latest state
    // after an unlink. Uses whichever handle we last matched on.
    const handle = user.username || user.email;
    if (!handle) return;
    const refreshed = await findUserForAdmin(handle);
    if (refreshed) setUser(refreshed);
  }

  return (
    <div className="space-y-4">
      <form
        action={search}
        className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label
            htmlFor="account-search"
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Look up user (username or email)
          </label>
          <input
            id="account-search"
            name="q"
            type="text"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="theresa or theresa@example.com"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching || query.trim().length === 0}
          className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSearching ? "Searching…" : "Search"}
        </button>
      </form>

      {searchError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {searchError}
        </p>
      )}
      {notFound && !user && (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          No user matches that username or email.
        </p>
      )}

      {user && <UserCard user={user} onChanged={refreshCurrent} />}
    </div>
  );
}

function UserCard({
  user,
  onChanged,
}: {
  user: AdminUserLookup;
  onChanged: () => void;
}) {
  const onlyAuth = user.accounts.length === 1 && !user.hasPassword;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              @{user.username ?? "—"}
            </h3>
            {user.displayName && (
              <span className="text-sm text-zinc-500">{user.displayName}</span>
            )}
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                user.tier === "premium"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {user.tier}
            </span>
            {user.suspended && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                suspended
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {user.email ?? "(no email)"} · id {user.id}
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Password sign-in:{" "}
            {user.hasPassword ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                set
              </span>
            ) : (
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                not set
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <h4 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Linked social sign-ins
        </h4>
        {user.accounts.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No OAuth accounts linked.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {user.accounts.map((a) => {
              const wouldLockOut =
                onlyAuth && user.accounts[0]?.id === a.id;
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize text-zinc-900 dark:text-zinc-100">
                      {a.provider}
                    </p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      provider id: {mask(a.providerAccountId)}
                    </p>
                  </div>
                  {wouldLockOut ? (
                    <span
                      className="text-xs text-zinc-500"
                      title="Unlinking this would leave the user with no way to sign in. Set a password first or link another provider."
                    >
                      last sign-in — locked
                    </span>
                  ) : (
                    <UnlinkForm
                      userId={user.id}
                      accountId={a.id}
                      provider={a.provider}
                      onDone={onChanged}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function UnlinkForm({
  userId,
  accountId,
  provider,
  onDone,
}: {
  userId: string;
  accountId: string;
  provider: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const form = new FormData();
    form.set("userId", userId);
    form.set("accountId", accountId);
    if (reason.trim()) form.set("reason", reason.trim());
    startTransition(async () => {
      try {
        await unlinkSocialAccount(form);
        setOpen(false);
        setReason("");
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unlink failed");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
      >
        Unlink
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={`Reason (logged) — e.g. user reported ${provider} compromised`}
        className="w-64 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-fuchsia-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReason("");
            setError(null);
          }}
          disabled={pending}
          className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Unlinking…" : "Confirm unlink"}
        </button>
      </div>
    </div>
  );
}

// Provider account IDs are opaque but sometimes long (Google's are ~21
// digits). Show enough to identify but not the whole thing — admins
// rarely need the full value and it clutters the row.
function mask(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
