"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export function SearchBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length >= 2) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      setIsOpen(false);
      setQuery("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative flex items-center">
      {isOpen ? (
        <form onSubmit={handleSubmit} className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search..."
            aria-label="Search"
            className="w-32 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm transition-all focus:w-44 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:w-40 sm:focus:w-52"
          />
        </form>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-teal-50 hover:text-teal-500 dark:text-zinc-400 dark:hover:bg-teal-900/20 dark:hover:text-teal-500"
          aria-label="Open search"
        >
          <svg
            className="h-5 w-5"
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
        </button>
      )}
    </div>
  );
}
