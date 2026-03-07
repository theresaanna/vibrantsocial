import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/feed");

  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center px-6">
      <main className="w-full max-w-xl space-y-10 py-20 text-center">
        <div className="space-y-5">
          <h1 className="text-4xl leading-tight tracking-tight text-zinc-900 sm:text-5xl sm:leading-tight dark:text-zinc-50">
            You&apos;ve arrived at{" "}
            <span className="font-semibold">VibrantSocial</span>.
          </h1>

          <p className="mx-auto max-w-md text-lg leading-relaxed text-zinc-500 dark:text-zinc-400">
            Relive the good ol&apos; days of the internet, before content
            algorithms and AI nonsense.
          </p>

          <p className="text-base text-zinc-400 dark:text-zinc-500">
            Social media for the bad knees crowd &mdash; we&apos;re 18+ only.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="w-full rounded-xl bg-zinc-900 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Create an Account
          </Link>
          <Link
            href="/login"
            className="w-full rounded-xl border border-zinc-200 px-8 py-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 sm:w-auto dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Sign In
          </Link>
        </div>
      </main>
    </div>
  );
}
