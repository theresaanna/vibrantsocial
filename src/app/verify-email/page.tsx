import type { Metadata } from "next";
import Link from "next/link";
import { verifyEmail } from "./actions";

export const metadata: Metadata = {
  title: "Verify Email",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token, email } = await searchParams;

  if (!token || !email) {
    return (
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
        <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Invalid verification link
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This email verification link is invalid or incomplete.
            </p>
          </div>
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            <Link
              href="/profile"
              className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
            >
              Go to profile settings
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const result = await verifyEmail(token, email);

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {result.success ? "Email verified" : "Verification failed"}
          </h1>
          <p
            className={`mt-2 text-sm ${
              result.success
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {result.message}
          </p>
        </div>
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href="/profile"
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Go to profile settings
          </Link>
        </p>
      </div>
    </div>
  );
}
