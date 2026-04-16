import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { userThemeSelect, buildUserTheme } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";

export const metadata: Metadata = {
  title: "Help",
  description: "Get help with VibrantSocial.",
};

export default async function HelpPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ...userThemeSelect },
  });
  if (!user) redirect("/login");

  const theme = buildUserTheme(user);

  return (
    <ThemedPage {...theme} className="mx-auto max-w-2xl px-4 py-6">
      <div className={`rounded-2xl p-6 shadow-lg ${theme.hasCustomTheme ? "profile-container" : "bg-white dark:bg-zinc-900"}`}>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Help
      </h1>

      <p className="mt-8 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Looking for support? Visit our{" "}
        <Link
          href="/support"
          className="font-medium text-purple-600 underline underline-offset-2 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
        >
          Support page
        </Link>{" "}
        to get in touch with the team.
      </p>

      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        You can also message{" "}
        <Link
          href="/theresa"
          className="font-medium text-purple-600 underline underline-offset-2 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
        >
          @theresa
        </Link>{" "}
        for assistance, or e-mail{" "}
        <a
          href="mailto:support@vibrantsocial.app"
          className="font-medium text-purple-600 underline underline-offset-2 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
        >
          support@vibrantsocial.app
        </a>{" "}
        directly.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Policies
      </h2>
      <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
        <li>
          <Link
            href="/tos"
            className="font-medium text-purple-600 underline underline-offset-2 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
          >
            Terms of Service
          </Link>
        </li>
        <li>
          <Link
            href="/privacy"
            className="font-medium text-purple-600 underline underline-offset-2 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
          >
            Privacy Policy
          </Link>
        </li>
        <li>
          <Link
            href="/cookies"
            className="font-medium text-purple-600 underline underline-offset-2 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
          >
            Cookie Policy
          </Link>
        </li>
        <li>
          <Link
            href="/dmca"
            className="font-medium text-purple-600 underline underline-offset-2 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
          >
            DMCA Policy
          </Link>
        </li>
      </ul>
      </div>
    </ThemedPage>
  );
}
