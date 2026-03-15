"use client";

import { useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { switchAccount } from "@/app/profile/account-linking-actions";
import type { LinkedAccount } from "@/types/next-auth";

function AccountAvatar({
  account,
  size = "sm",
}: {
  account: { avatar: string | null; displayName: string | null; username: string | null };
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm";

  if (account.avatar) {
    return (
      <img
        src={account.avatar}
        alt=""
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }

  const initial = (account.displayName || account.username || "?")[0].toUpperCase();
  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-blue-500 font-medium text-white`}
    >
      {initial}
    </div>
  );
}

export function AccountSwitcher({
  onAddAccount,
}: {
  onAddAccount?: () => void;
}) {
  const { data: session, update } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const linkedAccounts = session?.user?.linkedAccounts ?? [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (!session?.user || linkedAccounts.length === 0) return null;

  async function handleSwitch(targetAccount: LinkedAccount) {
    setSwitching(targetAccount.id);
    try {
      const result = await switchAccount(targetAccount.id);
      if (result.success) {
        await update({ switchToUserId: targetAccount.id });
        // Full reload so every server component, layout, and client cache
        // picks up the new identity (router.refresh() leaves stale data).
        window.location.reload();
      }
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-indigo-50 hover:text-indigo-500 dark:text-zinc-400 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-500"
        aria-label="Switch account"
        aria-expanded={isOpen}
        data-testid="account-switcher-button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          data-testid="account-switcher-dropdown"
        >
          {/* Current account */}
          <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              Current account
            </p>
            <div className="mt-1 flex items-center gap-2">
              <AccountAvatar account={session.user} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {session.user.displayName || session.user.username}
                </p>
                {session.user.username && (
                  <p className="truncate text-xs text-zinc-500">
                    @{session.user.username}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Linked accounts */}
          <div className="py-1">
            {linkedAccounts.map((account) => (
              <button
                key={account.id}
                onClick={() => handleSwitch(account)}
                disabled={switching !== null}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800"
                data-testid={`switch-to-${account.username}`}
              >
                <AccountAvatar account={account} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {account.displayName || account.username}
                  </p>
                  {account.username && (
                    <p className="truncate text-xs text-zinc-500">
                      @{account.username}
                    </p>
                  )}
                </div>
                {switching === account.id && (
                  <svg
                    className="h-4 w-4 animate-spin text-fuchsia-500"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Add account */}
          {onAddAccount && (
            <div className="border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onAddAccount();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-fuchsia-600 transition-colors hover:bg-fuchsia-50 dark:text-fuchsia-400 dark:hover:bg-fuchsia-900/20"
                data-testid="add-account-button"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add another account
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
