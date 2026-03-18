import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserViolations } from "./actions";
import { AppealForm } from "./appeal-form";

export const metadata: Metadata = {
  title: "Content Appeals",
  robots: { index: false, follow: false },
};

export default async function AppealsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const violations = await getUserViolations();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Content Violations &amp; Appeals
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        If you believe a content flag was made in error, you can contest it below. Appeals are reviewed manually.
      </p>

      {violations.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No content violations on your account.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {violations.map((v) => (
            <div
              key={v.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {v.type === "nsfw_unmarked"
                      ? "Unmarked NSFW"
                      : v.type === "hate_speech"
                        ? "Hate Speech"
                        : "Bullying"}
                  </span>
                  <span className="ml-2 text-xs text-zinc-400">
                    {v.action === "auto_flagged"
                      ? "Auto-flagged"
                      : "Pending review"}
                  </span>
                </div>
                <time className="text-xs text-zinc-400">
                  {new Date(v.createdAt).toLocaleDateString()}
                </time>
              </div>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                Confidence: {(v.confidence * 100).toFixed(1)}%
              </p>
              <AppealForm violationId={v.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
