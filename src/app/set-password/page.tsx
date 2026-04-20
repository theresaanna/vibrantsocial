import type { Metadata } from "next";
import Link from "next/link";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = {
  title: "Set Password",
  robots: { index: false, follow: false },
};

/**
 * Landing page for the email-confirmed "add a password" flow initiated
 * from /profile by OAuth-only users. Mirrors /reset-password structurally
 * (same search-param shape, same card layout) but uses a distinct token
 * identifier under the hood so the two flows never collide.
 */
export default async function SetPasswordPage({
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
              Invalid setup link
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This password setup link is invalid or has expired.
            </p>
          </div>
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            <Link
              href="/profile"
              className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
            >
              Request a new link from your profile
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Add a password
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            You&apos;ll still be able to sign in with your social account.
            This just adds a second way in.
          </p>
        </div>

        <SetPasswordForm token={token} email={email} />
      </div>
    </div>
  );
}
