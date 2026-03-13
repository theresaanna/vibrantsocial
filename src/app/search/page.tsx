import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { searchUsers, searchPosts } from "./actions";
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
  const tab = params.tab === "posts" ? "posts" : "users";

  let initialUsers = { users: [] as Awaited<ReturnType<typeof searchUsers>>["users"], hasMore: false };
  let initialPosts = { posts: [] as Awaited<ReturnType<typeof searchPosts>>["posts"], hasMore: false };

  if (query.length >= 2) {
    if (tab === "users") {
      initialUsers = await searchUsers(query);
    } else {
      initialPosts = await searchPosts(query);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <SearchPageClient
        initialQuery={query}
        initialTab={tab}
        initialUsers={initialUsers}
        initialPosts={initialPosts}
      />
    </main>
  );
}
