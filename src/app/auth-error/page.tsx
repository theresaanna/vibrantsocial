import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Authentication Error",
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email is already associated with a different sign-in method. Try signing in with your original method.",
  OAuthCallbackError:
    "There was an issue communicating with the authentication provider. Please try again.",
  OAuthProfileParseError:
    "Could not read your profile from the authentication provider. Please try again.",
  AccessDenied:
    "Access was denied. You may have declined the authorization request.",
  Verification:
    "The verification link has expired or has already been used.",
  Default:
    "An unexpected authentication error occurred. Please try again.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorType = error || "Default";
  const message = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.Default;

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Authentication Error
          </h1>
        </div>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          {message}
        </p>

        {error && (
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
            Error code: {errorType}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Link
            href="/profile"
            className="block w-full rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white transition-all hover:from-fuchsia-500 hover:to-blue-500"
          >
            Go to Profile
          </Link>
          <Link
            href="/login"
            className="block w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-center text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Try signing in again
          </Link>
        </div>
      </div>
    </div>
  );
}
