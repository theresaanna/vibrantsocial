"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { searchTags } from "@/app/tags/actions";
import { normalizeTag } from "@/lib/tags";

interface TagSuggestion {
  id: string;
  name: string;
  count: number;
}

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  includeNsfw?: boolean;
}

export function TagInput({ tags, onChange, disabled, includeNsfw }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const results = await searchTags(query, includeNsfw);
    // Filter out already selected tags
    const filtered = results.filter((s) => !tags.includes(s.name));
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setSelectedIndex(0);
  }, [tags, includeNsfw]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!inputValue.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(inputValue.trim());
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, fetchSuggestions]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function addTag(tagName: string) {
    const normalized = normalizeTag(tagName);
    if (normalized && !tags.includes(normalized)) {
      onChange([...tags, normalized]);
    }
    setInputValue("");
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function removeTag(tagName: string) {
    onChange(tags.filter((t) => t !== tagName));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        addTag(suggestions[selectedIndex].name);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed) {
        addTag(trimmed);
      }
      return;
    }

    if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  if (disabled) {
    return null;
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
        <svg
          className="h-3.5 w-3.5 shrink-0 text-zinc-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5"
          />
        </svg>
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-full p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label={`Remove tag ${tag}`}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "Add tags..." : ""}
          className="min-w-[80px] flex-1 bg-transparent text-xs text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
          data-testid="tag-input"
        />
      </div>

      {/* Hidden input for form submission */}
      <input type="hidden" name="tags" value={tags.join(",")} />

      {/* Typeahead suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="absolute left-4 right-4 z-20 mt-0.5 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          data-testid="tag-suggestions"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => addTag(suggestion.name)}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                index === selectedIndex
                  ? "bg-zinc-100 dark:bg-zinc-700"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
              }`}
              data-testid={`tag-suggestion-${suggestion.name}`}
            >
              <span className="text-zinc-900 dark:text-zinc-100">
                #{suggestion.name}
              </span>
              <span className="text-xs text-zinc-400">
                {suggestion.count} {suggestion.count === 1 ? "post" : "posts"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
