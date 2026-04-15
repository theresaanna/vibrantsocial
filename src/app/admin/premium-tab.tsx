"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { extendPremium, type ExtendPremiumState } from "./premium-actions";

export interface PremiumUser {
  id: string;
  username: string | null;
  email: string | null;
  avatar: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  premiumExpiresAt: Date | null;
  createdAt: Date;
}

export interface PremiumCompRecord {
  id: string;
  months: number;
  stripeSubscriptionId: string;
  previousTrialEnd: Date | null;
  newTrialEnd: Date;
  reason: string | null;
  createdAt: Date;
  admin: { username: string | null };
  user: { username: string | null };
}

export function PremiumTab({
  users,
  comps,
}: {
  users: PremiumUser[];
  comps: PremiumCompRecord[];
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [users, query]);

  const stripeBacked = filtered.filter((u) => u.stripeSubscriptionId);
  const nonStripe = filtered.filter((u) => !u.stripeSubscriptionId);

  return (
    <div className="space-y-4">
      <div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by username or email…"
          className="w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Stripe-backed premium ({stripeBacked.length})
        </h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {stripeBacked.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No Stripe-backed premium users match.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {stripeBacked.map((u) => (
                <PremiumRow key={u.id} user={u} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {nonStripe.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Comped / non-Stripe ({nonStripe.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {nonStripe.map((u) => (
                <li key={u.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={u} />
                    <div className="min-w-0 flex-1">
                      <a
                        href={`/${u.username}`}
                        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        @{u.username}
                      </a>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {u.email ?? "no email"} — comped / no Stripe subscription
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Recent comps
        </h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {comps.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No comps recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {comps.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium">@{c.admin.username}</span>
                    {" granted "}
                    <span className="inline-block rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      +{c.months} month{c.months === 1 ? "" : "s"}
                    </span>
                    {" to "}
                    <span className="font-medium">@{c.user.username}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    New trial end: {formatDate(c.newTrialEnd)}
                    {c.reason && ` — "${c.reason}"`}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {formatDate(c.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function PremiumRow({ user }: { user: PremiumUser }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState<ExtendPremiumState, FormData>(
    extendPremium,
    null
  );

  // Close the form automatically once the action reports success.
  useEffect(() => {
    if (state?.ok) setShowForm(false);
  }, [state]);

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} />
          <div className="min-w-0">
            <a
              href={`/${user.username}`}
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
            >
              @{user.username}
            </a>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {user.email ?? "no email"} — sub{" "}
              <code className="rounded bg-zinc-100 px-1 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {user.stripeSubscriptionId}
              </code>
            </p>
            {user.premiumExpiresAt && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Grace period ends {formatDate(user.premiumExpiresAt)}
              </p>
            )}
          </div>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
          >
            Comp months
          </button>
        )}
      </div>
      {showForm && (
        <form action={formAction} className="mt-3 flex flex-wrap items-start gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <label className="flex flex-col text-xs text-zinc-500 dark:text-zinc-400">
            Months
            <input
              name="months"
              type="number"
              min={1}
              max={24}
              defaultValue={1}
              required
              className="mt-1 w-20 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-1 min-w-[180px] flex-col text-xs text-zinc-500 dark:text-zinc-400">
            Reason (optional)
            <input
              name="reason"
              type="text"
              maxLength={500}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="e.g. contest winner"
            />
          </label>
          <div className="flex items-end gap-2 pt-4">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? "Working…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={pending}
              className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {state && !state.ok && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {state.message}
        </p>
      )}
    </li>
  );
}

function UserAvatar({ user }: { user: { avatar: string | null } }) {
  if (user.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />;
  }
  return <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />;
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString();
}
