import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 px-4 py-4 text-center sm:flex sm:items-center sm:justify-center sm:gap-4">
        <Link
          href="/tos"
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          Terms of Service
        </Link>
        <span className="hidden text-xs text-zinc-300 sm:inline dark:text-zinc-700">·</span>
        <Link
          href="/privacy"
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          Privacy Policy
        </Link>
        <span className="hidden text-xs text-zinc-300 sm:inline dark:text-zinc-700">·</span>
        <Link
          href="/dmca"
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          DMCA Policy
        </Link>
        <span className="hidden text-xs text-zinc-300 sm:inline dark:text-zinc-700">·</span>
        <Link
          href="/cookies"
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          Cookie Policy
        </Link>
        <span className="hidden text-xs text-zinc-300 sm:inline dark:text-zinc-700">·</span>
        <a
          href="mailto:vibrantsocial@proton.me"
          className="col-span-2 text-xs text-zinc-400 hover:text-zinc-600 sm:col-span-1 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          Support
        </a>
      </div>
    </footer>
  );
}
