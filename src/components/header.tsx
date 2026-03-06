import { auth, signOut } from "@/auth";
import Link from "next/link";
import { getConversations } from "@/app/chat/actions";
import { ChatNav } from "@/components/chat-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export async function Header() {
  const session = await auth();
  const conversations = session?.user ? await getConversations() : [];

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
        >
          VibrantSocial
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {session?.user ? (
            <>
              <Link
                href="/feed"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Feed
              </Link>
              <ChatNav initialConversations={conversations} />
              <Link
                href="/profile"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {session.user.displayName ?? session.user.name ?? "Profile"}
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Sign Out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
