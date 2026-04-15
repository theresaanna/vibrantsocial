export function MarketplaceNotice() {
  return (
    <div className="mb-4 rounded-2xl bg-zinc-50 p-4 shadow-sm dark:bg-zinc-800" data-testid="marketplace-notice">
      <div className="flex gap-3">
        <svg className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0020.01 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
        <div className="text-sm text-zinc-700 dark:text-zinc-300">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">Welcome to the Marketplace</p>
          <p className="mt-1 leading-relaxed">
            The marketplace welcomes anything you can ship or send digitally &mdash; as long as you own it or created it yourself, have full rights to sell it, and it is legal to sell both where you are and where it&apos;s being sold.
          </p>
        </div>
      </div>
    </div>
  );
}
