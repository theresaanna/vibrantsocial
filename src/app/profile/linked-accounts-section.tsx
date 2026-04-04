"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { unlinkAccount, getLinkedAccounts } from "./account-linking-actions";
import { LinkAccountModal } from "@/components/link-account-modal";
import type { LinkedAccount } from "@/types/next-auth";

export function LinkedAccountsSection() {
  const { update } = useSession();
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  useEffect(() => {
    getLinkedAccounts().then(setLinkedAccounts);
  }, []);

  return (
    <>
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700" data-testid="linked-accounts-section">
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Linked Accounts
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Link multiple accounts to switch between them without logging out.
        </p>

        {linkedAccounts.length > 0 && (
          <div className="mt-3 space-y-2">
            {linkedAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
                data-testid={`linked-account-${account.username}`}
              >
                <div className="flex items-center gap-2">
                  {account.avatar ? (
                    <img
                      src={account.avatar}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-blue-500 text-sm font-medium text-white">
                      {(account.displayName || account.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {account.displayName || account.username}
                    </p>
                    {account.username && (
                      <p className="text-xs text-zinc-500">@{account.username}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={unlinkingId !== null}
                  onClick={async () => {
                    setUnlinkingId(account.id);
                    try {
                      const result = await unlinkAccount(account.id);
                      if (result.success) {
                        setLinkedAccounts(result.linkedAccounts ?? []);
                        update({ refreshLinkedAccounts: true });
                      }
                    } finally {
                      setUnlinkingId(null);
                    }
                  }}
                  className="text-sm font-medium text-red-600 transition-colors hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                  data-testid={`unlink-${account.username}`}
                >
                  {unlinkingId === account.id ? "Unlinking..." : "Unlink"}
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowLinkModal(true)}
          className="mt-3 flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          data-testid="link-account-button"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Link another account
        </button>
      </div>

      {showLinkModal && (
        <LinkAccountModal
          isOpen={showLinkModal}
          onClose={() => setShowLinkModal(false)}
          onLinked={() => {
            getLinkedAccounts().then(setLinkedAccounts);
          }}
        />
      )}
    </>
  );
}
