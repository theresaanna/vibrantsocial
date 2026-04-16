"use client";

import { useState, useEffect, useRef } from "react";
import { searchUsers } from "@/app/messages/actions";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import type { ChatUserProfile } from "@/types/chat";

interface UserSearchProps {
  onSelect: (user: ChatUserProfile) => void;
  excludeIds?: string[];
  placeholder?: string;
}

export function UserSearch({
  onSelect,
  excludeIds = [],
  placeholder = "Search by username or name...",
}: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatUserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      const users = await searchUsers(query);
      if (cancelled) return;
      setResults(users.filter((u) => !excludeIds.includes(u.id)));
      setIsLoading(false);
      setShowResults(true);
    }, 300);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, excludeIds]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowResults(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
      />

      {showResults && (results.length > 0 || isLoading) && (
        <div className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-zinc-500">Searching...</p>
          ) : (
            results.map((user) => {
              const avatar = user.avatar ?? user.image;
              const name = user.displayName ?? user.username ?? user.name ?? "User";
              return (
                <button
                  key={user.id}
                  onClick={() => {
                    onSelect(user);
                    setQuery("");
                    setShowResults(false);
                    setResults([]);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  <FramedAvatar
                    src={avatar}
                    alt={name}
                    initial={name[0]?.toUpperCase()}
                    size={40}
                    frameId={user.profileFrameId}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      <StyledName fontId={user.usernameFont}>{name}</StyledName>
                    </p>
                    {user.username && (
                      <p className="truncate text-xs text-zinc-500">@{user.username}</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
