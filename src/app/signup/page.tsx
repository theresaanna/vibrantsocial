import { auth, signIn } from "@/auth";
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
            Join <span className="text-fuchsia-600 dark:text-fuchsia-400">Vibrant</span><span className="text-blue-600 dark:text-blue-400">Social</span> today
          </p>
        </div>

        <div className="rounded-lg bg-fuchsia-50/50 px-4 py-3 text-xs leading-relaxed text-zinc-500 dark:bg-fuchsia-900/10 dark:text-zinc-400">
          By using <span className="font-medium text-fuchsia-600 dark:text-fuchsia-400">Vibrant</span><span className="font-medium text-blue-600 dark:text-blue-400">Social</span> you agree to label adult and sensitive content
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

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              or continue with
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/complete-profile" });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:border-fuchsia-200 hover:bg-fuchsia-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-fuchsia-800 dark:hover:bg-fuchsia-900/20"
            >
              Continue with Google
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("discord", { redirectTo: "/complete-profile" });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:border-fuchsia-200 hover:bg-fuchsia-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-fuchsia-800 dark:hover:bg-fuchsia-900/20"
            >
              Continue with Discord
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-fuchsia-600 hover:underline dark:text-fuchsia-400"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
