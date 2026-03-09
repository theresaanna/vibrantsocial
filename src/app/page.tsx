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
            <span className="font-semibold"><span className="text-fuchsia-600 dark:text-fuchsia-400">Vibrant</span><span className="text-blue-600 dark:text-blue-400">Social</span></span>.
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
            className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-blue-600 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:from-fuchsia-500 hover:to-blue-500 sm:w-auto"
          >
            Create an Account
          </Link>
          <Link
            href="/login"
            className="w-full rounded-xl border border-fuchsia-200 px-8 py-3.5 text-sm font-medium text-fuchsia-700 transition-colors hover:bg-fuchsia-50 sm:w-auto dark:border-fuchsia-800 dark:text-fuchsia-300 dark:hover:bg-fuchsia-900/20"
          >
            Sign In
          </Link>
        </div>
      </main>
    </div>
  );
}
