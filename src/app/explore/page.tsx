import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getTagCloudPage } from "@/app/tags/actions";
import { TagCloud } from "./tag-cloud";
import { ExploreViewToggle } from "./explore-view-toggle";
import { ExploreRandomContent } from "./explore-random-content";
import { FeedSkeleton } from "@/components/feed-skeleton";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";

export const metadata: Metadata = {
  title: "Explore",
  description: "Explore tags and random posts on VibrantSocial.",
};

interface ExplorePageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const { view } = await searchParams;

  // Legacy redirects
  if (view === "user-lists") redirect("/lists?view=everyone");
  if (view === "media" || view === "discussions" || view === "newcomers" || view === "spotlight") redirect("/explore");

  const activeTab = view === "random" ? "random" : "tags";
  const activeView = view === "random-media" ? "media" : "posts";
  const resolvedTab = view === "random-media" ? "random" : activeTab;

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

  return (
    <ThemedPage {...theme}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "var(--profile-link, #d946ef)" }}>
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Explore
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Discover new posts and topics
          </p>
        </div>
      </div>

      <ExploreViewToggle activeTab={resolvedTab} hasCustomTheme={theme.hasCustomTheme} />

      {resolvedTab === "random" ? (
        session?.user?.id ? (
          <Suspense fallback={<FeedSkeleton />}>
            <ExploreRandomContent userId={session.user.id} activeView={activeView} />
          </Suspense>
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center shadow-lg dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">
              Log in to see random posts from across VibrantSocial.
            </p>
          </div>
        )
      ) : (
        <TagsContent showNsfwContent={showNsfwContent} />
      )}
    </ThemedPage>
  );
}

async function TagsContent({ showNsfwContent }: { showNsfwContent: boolean }) {
  const { tags, hasMore } = await getTagCloudPage(0, showNsfwContent);

  if (tags.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-lg dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">
          No tags yet. Be the first to tag a post!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
      <TagCloud
        initialTags={tags}
        initialHasMore={hasMore}
        showNsfwContent={showNsfwContent}
      />
    </div>
  );
}
