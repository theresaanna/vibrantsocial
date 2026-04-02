import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LinksForm } from "./links-form";
import { ThemedPage } from "@/components/themed-page";
import { userThemeSelect, buildUserTheme } from "@/lib/user-theme";

export const metadata: Metadata = {
  title: "Links Page Settings",
  robots: { index: false, follow: false },
};

export default async function LinksSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      ...userThemeSelect,
      username: true,
      linksPageEnabled: true,
      linksPageBio: true,
      linksPageLinks: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, url: true },
      },
    },
  });

  if (!user) redirect("/login");

  const theme = buildUserTheme(user);

  return (
    <ThemedPage {...theme}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Back to profile settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Links Page
          </h1>
        </div>

        <LinksForm
          enabled={user.linksPageEnabled}
          bio={user.linksPageBio || ""}
          links={user.linksPageLinks}
          username={user.username}
        />
      </div>
    </ThemedPage>
  );
}
