import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { userThemeSelect, buildUserTheme } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";
import { SupportForm } from "./support-form";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help from the VibrantSocial team.",
};

export default async function SupportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      username: true,
      email: true,
      ...userThemeSelect,
    },
  });

  if (!user) redirect("/login");

  const theme = buildUserTheme(user);

  return (
    <ThemedPage {...theme}>
      <div className="mx-auto max-w-lg">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Support
              </h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Fill out the form below and we&apos;ll get back to you as soon as
                possible. You can also email us directly at{" "}
                <a
                  href="mailto:support@vibrantsocial.app"
                  className="underline hover:text-zinc-900 dark:hover:text-zinc-200"
                >
                  support@vibrantsocial.app
                </a>
                .
              </p>
            </div>

            <SupportForm
              username={user.username ?? ""}
              email={user.email ?? ""}
            />
          </div>
        </div>
      </div>
    </ThemedPage>
  );
}
