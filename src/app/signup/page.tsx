import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SignupForm } from "./signup-form";
import Link from "next/link";

export default async function SignupPage() {
  const session = await auth();
  if (session) redirect("/feed");

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Join VibrantSocial today
          </p>
        </div>

        <div className="rounded-lg bg-zinc-50 px-4 py-3 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
          By using VibrantSocial you agree to label adult and sensitive content
          per our{" "}
          <Link
            href="/tos"
            target="_blank"
            className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
          >
            Terms of Service
          </Link>
          , and to adhere to all copyright and applicable laws in your
          jurisdiction.
        </div>

        <SignupForm />

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
