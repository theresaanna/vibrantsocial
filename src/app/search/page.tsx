import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { searchUsers, searchPosts } from "./actions";
import { SearchPageClient } from "./search-page-client";

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

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phoneVerified: true, biometricVerified: true, showNsfwByDefault: true },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <SearchPageClient
        initialQuery={query}
        initialTab={tab}
        initialUsers={initialUsers}
        initialPosts={initialPosts}
        currentUserId={session.user.id}
        phoneVerified={!!currentUser?.phoneVerified}
        biometricVerified={!!currentUser?.biometricVerified}
        showNsfwByDefault={currentUser?.showNsfwByDefault ?? false}
      />
    </main>
  );
}
