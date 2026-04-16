import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserLists, getCollaboratingLists } from "./actions";
import { ListsPageClient } from "./lists-page-client";
import { CommunitiesUserListsClient } from "@/app/communities/communities-user-lists-client";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";

export const metadata: Metadata = {
  title: "Lists",
  robots: { index: false, follow: false },
};

interface ListsPageProps {
  searchParams: Promise<{ view?: string }>;
}

const activeStyle: React.CSSProperties = {
  color: "var(--profile-bg, #fff)",
  backgroundColor: "var(--profile-text, #18181b)",
  boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
};

const inactiveStyle: React.CSSProperties = {
  color: "var(--profile-text, #18181b)",
  backgroundColor: "color-mix(in srgb, var(--profile-secondary, #71717a) 15%, transparent)",
};

export default async function ListsPage({ searchParams }: ListsPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { view } = await searchParams;
  const activeView = view === "everyone" ? "everyone" : "mine";

  const [lists, collaboratingLists, themeUser] = await Promise.all([
    activeView === "mine" ? getUserLists() : Promise.resolve([]),
    activeView === "mine" ? getCollaboratingLists() : Promise.resolve([]),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: userThemeSelect,
    }),
  ]);

  const theme = themeUser ? buildUserTheme(themeUser) : null;
  const baseClass = "flex-1 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all text-center";

  return (
    <ThemedPage {...(theme ?? NO_THEME)}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "var(--profile-link, #d946ef)" }}>
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Lists</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Create lists to make custom feeds, and find others&apos; lists
          </p>
        </div>
      </div>

      <div className="mb-4 flex gap-2" role="tablist" aria-label="Lists view">
        <Link
          href="/lists"
          role="tab"
          aria-selected={activeView === "mine"}
          className={baseClass}
          style={activeView === "mine" ? activeStyle : inactiveStyle}
        >
          My Lists
        </Link>
        <Link
          href="/lists?view=everyone"
          role="tab"
          aria-selected={activeView === "everyone"}
          className={baseClass}
          style={activeView === "everyone" ? activeStyle : inactiveStyle}
        >
          Everyone&apos;s Lists
        </Link>
      </div>

      {activeView === "everyone" ? (
        <Suspense
          fallback={
            <div className="mt-6 flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
            </div>
          }
        >
          <CommunitiesUserListsClient />
        </Suspense>
      ) : (
        <ListsPageClient
          lists={JSON.parse(JSON.stringify(lists))}
          collaboratingLists={JSON.parse(JSON.stringify(collaboratingLists))}
        />
      )}
    </ThemedPage>
  );
}
