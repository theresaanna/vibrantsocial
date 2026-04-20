"use client";

import { useState, useTransition } from "react";
import {
  unlinkMyOAuthAccount,
  type OAuthConnection,
} from "./oauth-actions";

interface Props {
  initialConnections: OAuthConnection[];
  hasPassword: boolean;
}

/**
 * Self-service list of the viewer's OAuth connections (Google, Discord,
 * etc.) with an Unlink button per row. The last remaining sign-in
 * method is locked with an explanatory badge; the server enforces the
 * same rule, so this is UX, not security.
 *
 * NOTE: Distinct from `linked-accounts-section.tsx`, which is about
 * multi-*user* account switching and has nothing to do with OAuth.
 */
export function OAuthConnectionsSection({
  initialConnections,
  hasPassword,
}: Props) {
  const [connections, setConnections] = useState(initialConnections);

  if (connections.length === 0) return null;

  const onlySignInMethod = !hasPassword && connections.length === 1;

  return (
    <div
      className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
      data-testid="oauth-connections-section"
    >
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Connected sign-ins
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Services you can use to sign in to your account.
      </p>

      <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
        {connections.map((c) => {
          const isLast = onlySignInMethod && connections[0]?.id === c.id;
          return (
            <ConnectionRow
              key={c.id}
              connection={c}
              locked={isLast}
              onUnlinked={() =>
                setConnections((prev) =>
                  prev.filter((x) => x.id !== c.id),
                )
              }
            />
          );
        })}
      </ul>

      {onlySignInMethod && (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          This is your only way to sign in. Set a password or connect
          another service to unlock disconnecting it.
        </p>
      )}
    </div>
  );
}

function ConnectionRow({
  connection,
  locked,
  onUnlinked,
}: {
  connection: OAuthConnection;
  locked: boolean;
  onUnlinked: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function unlink() {
    setError(null);
    const form = new FormData();
    form.set("accountId", connection.id);
    startTransition(async () => {
      const res = await unlinkMyOAuthAccount(form);
      if (res.success) {
        onUnlinked();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div>
        <p className="text-sm font-medium capitalize text-zinc-900 dark:text-zinc-100">
          {connection.provider}
        </p>
        {error && (
          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
      {locked ? (
        <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          Only sign-in
        </span>
      ) : (
        <button
          type="button"
          onClick={unlink}
          disabled={pending}
          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
        >
          {pending ? "Disconnecting…" : "Disconnect"}
        </button>
      )}
    </li>
  );
}
