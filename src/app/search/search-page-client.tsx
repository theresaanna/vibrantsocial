"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { searchUsers, searchPosts } from "./actions";
import { SearchPostCard } from "@/components/search-post-card";
import { SearchUserCard } from "@/components/search-user-card";

type SearchTab = "users" | "posts";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface SearchPageClientProps {
  initialQuery: string;
  initialTab: SearchTab;
  initialUsers: { users: any[]; hasMore: boolean };
  initialPosts: { posts: any[]; hasMore: boolean };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function SearchPageClient({
  initialQuery,
  initialTab,
  initialUsers,
  initialPosts,
}: SearchPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [users, setUsers] = useState<any[]>(initialUsers.users);
  const [usersHasMore, setUsersHasMore] = useState(initialUsers.hasMore);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [posts, setPosts] = useState<any[]>(initialPosts.posts);
  const [postsHasMore, setPostsHasMore] = useState(initialPosts.hasMore);
  const [isPending, startTransition] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSearchedQuery = useRef(initialQuery);

  // Auto-focus the search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed === lastSearchedQuery.current) return;

    if (!trimmed || trimmed.length < 2) {
      setUsers([]);
      setUsersHasMore(false);
      setPosts([]);
      setPostsHasMore(false);
      lastSearchedQuery.current = trimmed;
      return;
    }

    debounceRef.current = setTimeout(() => {
      lastSearchedQuery.current = trimmed;
      const params = new URLSearchParams(searchParams.toString());
      params.set("q", trimmed);
      params.set("tab", activeTab);
      router.replace(`/search?${params.toString()}`);

      startTransition(async () => {
        if (activeTab === "users") {
          const result = await searchUsers(trimmed);
          setUsers(result.users);
          setUsersHasMore(result.hasMore);
        } else {
          const result = await searchPosts(trimmed);
          setPosts(result.posts);
          setPostsHasMore(result.hasMore);
        }
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeTab, router, searchParams]);

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    const trimmed = query.trim();
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/search?${params.toString()}`);

    if (trimmed.length >= 2) {
      startTransition(async () => {
        if (tab === "users") {
          const result = await searchUsers(trimmed);
          setUsers(result.users);
          setUsersHasMore(result.hasMore);
        } else {
          const result = await searchPosts(trimmed);
          setPosts(result.posts);
          setPostsHasMore(result.hasMore);
        }
      });
    }
  };

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;

    if (activeTab === "users") {
      if (!usersHasMore) return;
      const lastUser = users[users.length - 1];
      if (!lastUser) return;
      loadingRef.current = true;

      startTransition(async () => {
        try {
          const result = await searchUsers(trimmed, lastUser.id);
          setUsers((prev) => [...prev, ...result.users]);
          setUsersHasMore(result.hasMore);
        } finally {
          loadingRef.current = false;
        }
      });
    } else {
      if (!postsHasMore) return;
      const lastPost = posts[posts.length - 1];
      if (!lastPost) return;
      loadingRef.current = true;

      startTransition(async () => {
        try {
          const result = await searchPosts(
            trimmed,
            lastPost.createdAt
          );
          setPosts((prev) => [...prev, ...result.posts]);
          setPostsHasMore(result.hasMore);
        } finally {
          loadingRef.current = false;
        }
      });
    }
  }, [query, activeTab, users, usersHasMore, posts, postsHasMore]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const trimmedQuery = query.trim();
  const hasSearched = trimmedQuery.length >= 2;

  return (
    <div>
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users and posts..."
          aria-label="Search"
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 pl-10 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>

      <div className="mt-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => handleTabChange("users")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "users"
              ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Users
        </button>
        <button
          onClick={() => handleTabChange("posts")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "posts"
              ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Posts
        </button>
      </div>

      <div className="mt-4">
        {activeTab === "users" ? (
          <>
            {hasSearched && users.length === 0 && !isPending && (
              <p className="py-8 text-center text-sm text-zinc-500">
                No users found
              </p>
            )}
            <div className="space-y-3">
              {users.map((user) => (
                <SearchUserCard key={user.id} user={user} />
              ))}
            </div>
          </>
        ) : (
          <>
            {hasSearched && posts.length === 0 && !isPending && (
              <p className="py-8 text-center text-sm text-zinc-500">
                No posts found
              </p>
            )}
            <div className="space-y-3">
              {posts.map((post) => (
                <SearchPostCard key={post.id} post={post} />
              ))}
            </div>
          </>
        )}

        <div ref={sentinelRef} className="h-1" />

        {isPending && (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
          </div>
        )}
      </div>
    </div>
  );
}
