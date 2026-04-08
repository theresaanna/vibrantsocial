import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTagCloudData, getAllTagCloudData } from "@/app/tags/actions";
import { TagCloud } from "./tag-cloud";
import { CommunitiesViewToggle } from "./communities-view-toggle";
import { CommunitiesMediaClient } from "./communities-media-client";
import { CommunitiesDiscussionsClient } from "./communities-discussions-client";
import { CommunitiesNewcomersClient } from "./communities-newcomers-client";
import { CommunitiesSpotlightClient } from "./communities-spotlight-client";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";

export const metadata: Metadata = {
  title: "Communities",
  description: "Explore tags and communities on VibrantSocial.",
};

interface CommunitiesPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function CommunitiesPage({ searchParams }: CommunitiesPageProps) {
  const { view } = await searchParams;
  const activeView = view === "media" ? "media" : view === "discussions" ? "discussions" : view === "newcomers" ? "newcomers" : view === "spotlight" ? "spotlight" : "tags";

  const session = await auth();
  let showNsfwContent = false;
  let theme = NO_THEME;

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { showNsfwContent: true, ...userThemeSelect },
    });
    showNsfwContent = user?.showNsfwContent ?? false;
    if (user) theme = buildUserTheme(user);
  }

  const tagData = showNsfwContent
    ? await getAllTagCloudData()
    : await getTagCloudData();

  return (
    <ThemedPage {...theme}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-400 to-pink-600">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Communities
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Explore topics and discover posts by tag
          </p>
        </div>
      </div>

      <CommunitiesViewToggle activeView={activeView} />

      {activeView === "media" ? (
        <Suspense
          fallback={
            <div className="mt-6 flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
            </div>
          }
        >
          <CommunitiesMediaClient />
        </Suspense>
      ) : activeView === "discussions" ? (
        <Suspense
          fallback={
            <div className="mt-6 flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
            </div>
          }
        >
          <CommunitiesDiscussionsClient />
        </Suspense>
      ) : activeView === "spotlight" ? (
        <Suspense
          fallback={
            <div className="mt-6 flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
            </div>
          }
        >
          <CommunitiesSpotlightClient />
        </Suspense>
      ) : activeView === "newcomers" ? (
        <Suspense
          fallback={
            <div className="mt-6 flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
            </div>
          }
        >
          <CommunitiesNewcomersClient />
        </Suspense>
      ) : tagData.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-lg dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">
            No tags yet. Be the first to tag a post!
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
          <TagCloud tags={tagData} />
        </div>
      )}

    </ThemedPage>
  );
}
