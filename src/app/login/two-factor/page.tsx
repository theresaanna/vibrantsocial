import type { Metadata } from "next";
import { TwoFactorForm } from "./two-factor-form";

export const metadata: Metadata = {
  title: "Two-Factor Authentication",
  description: "Verify your identity with two-factor authentication.",
  robots: { index: false, follow: false },
};

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
        <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
          <p className="text-center text-sm text-red-600">
            Invalid or expired session. Please{" "}
            <a href="/login" className="font-medium underline">
              log in again
            </a>
            .
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
            Two-Factor Authentication
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Enter a code from your authenticator app to continue.
          </p>
        </div>

        <TwoFactorForm pendingToken={token} />
      </div>
    </div>
  );
}
