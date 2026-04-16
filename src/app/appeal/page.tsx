import type { Metadata } from "next";
import { auth } from "@/auth";
import { AppealForm } from "./appeal-form";

export const metadata: Metadata = {
  title: "Submit an Appeal",
  robots: { index: false, follow: false },
};

export default async function AppealPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user?.id;

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "var(--profile-link, #d946ef)" }}>
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Submit an Appeal
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isLoggedIn
              ? "Appeal a content warning or moderation action"
              : "Appeal an account suspension"}
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <AppealForm isLoggedIn={isLoggedIn} />
      </div>
    </main>
  );
}
