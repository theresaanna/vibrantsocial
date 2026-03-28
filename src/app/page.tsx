import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FeatureShowcase } from "@/components/feature-showcase";

export const metadata: Metadata = {
  title: "VibrantSocial — Social media for adults",
  description:
    "Return to the good ol' days of the internet, before revenue-driving algorithms and AI generated nonsense.",
};

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/feed");

  return (
    <div className="flex flex-col">
      {/* Hero — fills the first viewport */}
      <section className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center px-6">
        <div className="w-full max-w-xl space-y-10 py-20 text-center">
          <div className="space-y-5">
            <h1 className="text-4xl leading-tight tracking-tight text-zinc-900 sm:text-5xl sm:leading-tight dark:text-zinc-50">
              You&apos;ve arrived at{" "}
              <span className="font-semibold"><span className="text-fuchsia-600 dark:text-fuchsia-400">Vibrant</span><span className="text-blue-600 dark:text-blue-400">Social</span></span>.
            </h1>

            <p className="mx-auto max-w-md text-lg leading-relaxed text-zinc-500 dark:text-zinc-400">
              Return to the good ol&apos; days of the internet, before
              revenue-driving algorithms and AI generated nonsense.
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

          {/* Scroll hint */}
          <div className="animate-bounce pt-8 text-zinc-300 dark:text-zinc-600">
            <svg className="mx-auto h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* Feature showcase sections */}
      <FeatureShowcase />
    </div>
  );
}
