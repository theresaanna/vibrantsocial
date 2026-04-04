"use client";

import { signOut } from "next-auth/react";
import { Tooltip } from "@/components/tooltip";

export function LogoutButton() {
  return (
    <Tooltip label="Log out">
      <button
        onClick={() => signOut({ redirectTo: "/" })}
        className="relative flex items-center gap-1 rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-zinc-400 dark:hover:bg-red-900/20 dark:hover:text-red-500"
        aria-label="Log out"
        data-testid="logout-button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3l3-3m0 0l-3-3m3 3H9" />
        </svg>
      </button>
    </Tooltip>
  );
}
