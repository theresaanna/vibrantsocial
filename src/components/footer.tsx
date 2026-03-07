import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-3xl items-center justify-center gap-4 px-4 py-4">
        <Link
          href="/tos"
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          Terms of Service
        </Link>
        <span className="text-xs text-zinc-300 dark:text-zinc-700">·</span>
        <Link
          href="/privacy"
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}
