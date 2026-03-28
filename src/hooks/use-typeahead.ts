"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { searchUsers } from "@/app/chat/actions";
import { searchTags } from "@/app/tags/actions";
import type { ChatUserProfile } from "@/types/chat";

export type TypeaheadMode = "mention" | "hashtag" | null;

export interface TagResult {
  id: string;
  name: string;
  count: number;
}

export interface TypeaheadState {
  mode: TypeaheadMode;
  query: string | null;
  mentionResults: ChatUserProfile[];
  tagResults: TagResult[];
  selectedIndex: number;
  isOpen: boolean;
}

interface UseTypeaheadOptions {
  /** The current text value of the input/textarea */
  value: string;
  /** Callback to update the text value */
  setValue: (value: string) => void;
  /** Ref to the input or textarea element */
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  /** Search debounce in ms (default 300) */
  debounceMs?: number;
}

export function useTypeahead({
  value,
  setValue,
  inputRef,
  debounceMs = 300,
}: UseTypeaheadOptions) {
  const [query, setQuery] = useState<string | null>(null);
  const [mode, setMode] = useState<TypeaheadMode>(null);
  const [mentionResults, setMentionResults] = useState<ChatUserProfile[]>([]);
  const [tagResults, setTagResults] = useState<TagResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const resultsCount =
    mode === "mention" ? mentionResults.length : tagResults.length;
  const isOpen = query !== null && resultsCount > 0;

  // Detect @mention or #hashtag trigger from cursor position
  const detectTrigger = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart ?? 0;
    const textBeforeCursor = value.slice(0, cursorPos);

    // Check for #hashtag first
    const hashMatch = textBeforeCursor.match(/(?:^|[\s])#([\w-]*)$/);
    if (hashMatch) {
      setQuery(hashMatch[1]);
      setMode("hashtag");
      const rect = input.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
      return;
    }

    // Check for @mention
    const mentionMatch = textBeforeCursor.match(/(?:^|[\s])@([\w]*)$/);
    if (mentionMatch) {
      setQuery(mentionMatch[1]);
      setMode("mention");
      const rect = input.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
      return;
    }

    setQuery(null);
    setMode(null);
    setMentionResults([]);
    setTagResults([]);
  }, [value, inputRef]);

  // Search when query changes
  useEffect(() => {
    if (query === null || query.length < 1 || mode === null) {
      setMentionResults([]);
      setTagResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (mode === "mention") {
        const users = await searchUsers(query);
        setMentionResults(users.filter((u) => u.username));
        setTagResults([]);
      } else {
        const tags = await searchTags(query);
        setTagResults(tags);
        setMentionResults([]);
      }
      setSelectedIndex(0);
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode, debounceMs]);

  // Insert mention into the value
  const insertMention = useCallback(
    (user: ChatUserProfile) => {
      const input = inputRef.current;
      if (!input) return;

      const cursorPos = input.selectionStart ?? 0;
      const textBeforeCursor = value.slice(0, cursorPos);
      const textAfterCursor = value.slice(cursorPos);

      const match = textBeforeCursor.match(/(?:^|([\s]))@[\w]*$/);
      if (!match) return;

      const atIndex = textBeforeCursor.lastIndexOf("@");
      const beforeAt = value.slice(0, atIndex);
      const mention = `@${user.username} `;
      const newValue = beforeAt + mention + textAfterCursor;

      setValue(newValue);
      setQuery(null);
      setMode(null);
      setMentionResults([]);

      const newCursorPos = beforeAt.length + mention.length;
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [value, setValue, inputRef]
  );

  // Insert hashtag into the value
  const insertHashtag = useCallback(
    (tag: TagResult) => {
      const input = inputRef.current;
      if (!input) return;

      const cursorPos = input.selectionStart ?? 0;
      const textBeforeCursor = value.slice(0, cursorPos);
      const textAfterCursor = value.slice(cursorPos);

      const hashIndex = textBeforeCursor.lastIndexOf("#");
      const beforeHash = value.slice(0, hashIndex);
      const hashtag = `#${tag.name} `;
      const newValue = beforeHash + hashtag + textAfterCursor;

      setValue(newValue);
      setQuery(null);
      setMode(null);
      setTagResults([]);

      const newCursorPos = beforeHash.length + hashtag.length;
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [value, setValue, inputRef]
  );

  // Handle keyboard navigation — returns true if the event was consumed
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isOpen) return false;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % resultsCount);
        return true;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + resultsCount) % resultsCount);
        return true;
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (mode === "mention" && mentionResults[selectedIndex]) {
          insertMention(mentionResults[selectedIndex]);
        } else if (mode === "hashtag" && tagResults[selectedIndex]) {
          insertHashtag(tagResults[selectedIndex]);
        }
        return true;
      } else if (e.key === "Escape") {
        e.preventDefault();
        setQuery(null);
        setMode(null);
        setMentionResults([]);
        setTagResults([]);
        return true;
      }
      return false;
    },
    [
      isOpen,
      resultsCount,
      selectedIndex,
      insertMention,
      insertHashtag,
      mode,
      mentionResults,
      tagResults,
    ]
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setQuery(null);
        setMode(null);
        setMentionResults([]);
        setTagResults([]);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, inputRef]);

  return {
    mode,
    query,
    mentionResults,
    tagResults,
    selectedIndex,
    isOpen,
    dropdownPos,
    dropdownRef,
    detectTrigger,
    handleKeyDown,
    insertMention,
    insertHashtag,
  };
}
