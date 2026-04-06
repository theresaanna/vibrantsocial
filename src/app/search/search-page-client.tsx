"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { rpc } from "@/lib/rpc";
import { SearchPostCard } from "@/components/search-post-card";
import { SearchUserCard } from "@/components/search-user-card";

type SearchTab = "users" | "posts" | "tags" | "marketplace";

interface SearchTag {
  id: string;
  name: string;
  isNsfw: boolean;
  postCount: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface SearchPageClientProps {
  initialQuery: string;
  initialTab: SearchTab;
  initialUsers: { users: any[]; hasMore: boolean };
  initialPosts: { posts: any[]; hasMore: boolean };
  initialTags: { tags: SearchTag[]; hasMore: boolean };
  initialMarketplace: { posts: any[]; hasMore: boolean };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function SearchPageClient({
  initialQuery,
  initialTab,
  initialUsers,
  initialPosts,
  initialTags,
  initialMarketplace,
}: SearchPageClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [users, setUsers] = useState<any[]>(initialUsers.users);
  const [usersHasMore, setUsersHasMore] = useState(initialUsers.hasMore);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [posts, setPosts] = useState<any[]>(initialPosts.posts);
  const [postsHasMore, setPostsHasMore] = useState(initialPosts.hasMore);
  const [tags, setTags] = useState<SearchTag[]>(initialTags.tags);
  const [tagsHasMore, setTagsHasMore] = useState(initialTags.hasMore);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [marketplacePosts, setMarketplacePosts] = useState<any[]>(initialMarketplace.posts);
  const [marketplaceHasMore, setMarketplaceHasMore] = useState(initialMarketplace.hasMore);
  const [isPending, startTransition] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSearchedQuery = useRef(initialQuery);
  const searchIdRef = useRef(0);

  // Auto-focus the search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Redirect #tag searches to the tag page
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.startsWith("#") && trimmed.length > 1) {
      const tagName = trimmed.slice(1).toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (tagName) {
        router.push(`/tag/${tagName}`);
      }
    }
  }, [query, router]);

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
      setTags([]);
      setTagsHasMore(false);
      setMarketplacePosts([]);
      setMarketplaceHasMore(false);
      lastSearchedQuery.current = trimmed;
      return;
    }

    debounceRef.current = setTimeout(() => {
      lastSearchedQuery.current = trimmed;
      window.history.replaceState(null, "", `/search?q=${encodeURIComponent(trimmed)}&tab=${activeTab}`);

      const id = ++searchIdRef.current;
      startTransition(async () => {
        if (activeTab === "users") {
          const result = await rpc<{ users: any[]; hasMore: boolean }>("searchUsers", trimmed);
          if (searchIdRef.current !== id) return;
          setUsers(result.users);
          setUsersHasMore(result.hasMore);
        } else if (activeTab === "posts") {
          const result = await rpc<{ posts: any[]; hasMore: boolean }>("searchPosts", trimmed);
          if (searchIdRef.current !== id) return;
          setPosts(result.posts);
          setPostsHasMore(result.hasMore);
        } else if (activeTab === "marketplace") {
          const result = await rpc<{ posts: any[]; hasMore: boolean }>("searchMarketplacePosts", trimmed);
          if (searchIdRef.current !== id) return;
          setMarketplacePosts(result.posts);
          setMarketplaceHasMore(result.hasMore);
        } else {
          const result = await rpc<{ tags: SearchTag[]; hasMore: boolean }>("searchTagsForSearch", trimmed);
          if (searchIdRef.current !== id) return;
          setTags(result.tags);
          setTagsHasMore(result.hasMore);
        }
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeTab]);

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    const trimmed = query.trim();
    window.history.replaceState(null, "", `/search?q=${encodeURIComponent(trimmed)}&tab=${tab}`);

    if (trimmed.length >= 2) {
      const id = ++searchIdRef.current;
      startTransition(async () => {
        if (tab === "users") {
          const result = await rpc<{ users: any[]; hasMore: boolean }>("searchUsers", trimmed);
          if (searchIdRef.current !== id) return;
          setUsers(result.users);
          setUsersHasMore(result.hasMore);
        } else if (tab === "posts") {
          const result = await rpc<{ posts: any[]; hasMore: boolean }>("searchPosts", trimmed);
          if (searchIdRef.current !== id) return;
          setPosts(result.posts);
          setPostsHasMore(result.hasMore);
        } else if (tab === "marketplace") {
          const result = await rpc<{ posts: any[]; hasMore: boolean }>("searchMarketplacePosts", trimmed);
          if (searchIdRef.current !== id) return;
          setMarketplacePosts(result.posts);
          setMarketplaceHasMore(result.hasMore);
        } else {
          const result = await rpc<{ tags: SearchTag[]; hasMore: boolean }>("searchTagsForSearch", trimmed);
          if (searchIdRef.current !== id) return;
          setTags(result.tags);
          setTagsHasMore(result.hasMore);
        }
      });
    }
  };

  // Use refs for values that loadMore reads but shouldn't trigger observer recreation
  const queryRef = useRef(query);
  const activeTabRef = useRef(activeTab);
  const usersRef = useRef(users);
  const postsRef = useRef(posts);
  const tagsRef = useRef(tags);
  const usersHasMoreRef = useRef(usersHasMore);
  const postsHasMoreRef = useRef(postsHasMore);
  const tagsHasMoreRef = useRef(tagsHasMore);
  const marketplacePostsRef = useRef(marketplacePosts);
  const marketplaceHasMoreRef = useRef(marketplaceHasMore);

  useEffect(() => { queryRef.current = query; }, [query]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { postsRef.current = posts; }, [posts]);
  useEffect(() => { tagsRef.current = tags; }, [tags]);
  useEffect(() => { usersHasMoreRef.current = usersHasMore; }, [usersHasMore]);
  useEffect(() => { postsHasMoreRef.current = postsHasMore; }, [postsHasMore]);
  useEffect(() => { tagsHasMoreRef.current = tagsHasMore; }, [tagsHasMore]);
  useEffect(() => { marketplacePostsRef.current = marketplacePosts; }, [marketplacePosts]);
  useEffect(() => { marketplaceHasMoreRef.current = marketplaceHasMore; }, [marketplaceHasMore]);

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    const trimmed = queryRef.current.trim();
    if (!trimmed || trimmed.length < 2) return;

    if (activeTabRef.current === "users") {
      if (!usersHasMoreRef.current) return;
      const lastUser = usersRef.current[usersRef.current.length - 1];
      if (!lastUser) return;
      loadingRef.current = true;

      startTransition(async () => {
        try {
          const result = await rpc<{ users: any[]; hasMore: boolean }>("searchUsers", trimmed, lastUser.id);
          setUsers((prev) => [...prev, ...result.users]);
          setUsersHasMore(result.hasMore);
        } finally {
          loadingRef.current = false;
        }
      });
    } else if (activeTabRef.current === "posts") {
      if (!postsHasMoreRef.current) return;
      const lastPost = postsRef.current[postsRef.current.length - 1];
      if (!lastPost) return;
      loadingRef.current = true;

      startTransition(async () => {
        try {
          const result = await rpc<{ posts: any[]; hasMore: boolean }>(
            "searchPosts",
            trimmed,
            lastPost.createdAt
          );
          setPosts((prev) => [...prev, ...result.posts]);
          setPostsHasMore(result.hasMore);
        } finally {
          loadingRef.current = false;
        }
      });
    } else if (activeTabRef.current === "marketplace") {
      if (!marketplaceHasMoreRef.current) return;
      const lastPost = marketplacePostsRef.current[marketplacePostsRef.current.length - 1];
      if (!lastPost) return;
      loadingRef.current = true;

      startTransition(async () => {
        try {
          const result = await rpc<{ posts: any[]; hasMore: boolean }>(
            "searchMarketplacePosts",
            trimmed,
            lastPost.createdAt
          );
          setMarketplacePosts((prev) => [...prev, ...result.posts]);
          setMarketplaceHasMore(result.hasMore);
        } finally {
          loadingRef.current = false;
        }
      });
    } else {
      if (!tagsHasMoreRef.current) return;
      const lastTag = tagsRef.current[tagsRef.current.length - 1];
      if (!lastTag) return;
      loadingRef.current = true;

      startTransition(async () => {
        try {
          const result = await rpc<{ tags: SearchTag[]; hasMore: boolean }>("searchTagsForSearch", trimmed, lastTag.id);
          setTags((prev) => [...prev, ...result.tags]);
          setTagsHasMore(result.hasMore);
        } finally {
          loadingRef.current = false;
        }
      });
    }
  }, []); // Stable reference — reads from refs

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
          placeholder="Search users, posts, and tags..."
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

      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-lg dark:bg-zinc-900">
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700">
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
        <button
          onClick={() => handleTabChange("tags")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "tags"
              ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Tags
        </button>
        <button
          onClick={() => handleTabChange("marketplace")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "marketplace"
              ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Marketplace
        </button>
      </div>

      <div className="p-4">
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
        ) : activeTab === "posts" ? (
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
        ) : activeTab === "tags" ? (
          <>
            {hasSearched && tags.length === 0 && !isPending && (
              <p className="py-8 text-center text-sm text-zinc-500">
                No tags found
              </p>
            )}
            <div className="space-y-3">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tag/${tag.name}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-zinc-400 dark:text-zinc-500">#</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {tag.name}
                    </span>
                    {tag.isNsfw && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        NSFW
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {tag.postCount} {tag.postCount === 1 ? "post" : "posts"}
                  </span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            {hasSearched && marketplacePosts.length === 0 && !isPending && (
              <p className="py-8 text-center text-sm text-zinc-500">
                No marketplace listings found
              </p>
            )}
            <div className="space-y-3">
              {marketplacePosts.map((post) => (
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
    </div>
  );
}
