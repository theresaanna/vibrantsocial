import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { searchUsers, searchPosts, searchTagsForSearch, searchMarketplacePosts } from "./actions";
import { SearchPageClient } from "./search-page-client";

export const metadata: Metadata = {
  title: "Search",
  description: "Search for people and posts on VibrantSocial.",
  robots: { index: false, follow: false },
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string; tab?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const query = params.q ?? "";
  const tab = params.tab === "posts" ? "posts" : params.tab === "tags" ? "tags" : params.tab === "marketplace" ? "marketplace" : "users";

  let initialUsers = { users: [] as Awaited<ReturnType<typeof searchUsers>>["users"], hasMore: false };
  let initialPosts = { posts: [] as Awaited<ReturnType<typeof searchPosts>>["posts"], hasMore: false };
  let initialTags = { tags: [] as Awaited<ReturnType<typeof searchTagsForSearch>>["tags"], hasMore: false };
  let initialMarketplace = { posts: [] as Awaited<ReturnType<typeof searchMarketplacePosts>>["posts"], hasMore: false };

  if (query.length >= 2) {
    if (tab === "users") {
      initialUsers = await searchUsers(query);
    } else if (tab === "posts") {
      initialPosts = await searchPosts(query);
    } else if (tab === "marketplace") {
      initialMarketplace = await searchMarketplacePosts(query);
    } else {
      initialTags = await searchTagsForSearch(query);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-600">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Search
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Find people, posts, tags, and listings
          </p>
        </div>
      </div>

      <SearchPageClient
        initialQuery={query}
        initialTab={tab}
        initialUsers={initialUsers}
        initialPosts={initialPosts}
        initialTags={initialTags}
        initialMarketplace={initialMarketplace}
      />
    </main>
  );
}
