"use client";

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { searchUsers } from "@/app/chat/actions";
import { searchTags } from "@/app/tags/actions";
import { FramedAvatar } from "@/components/framed-avatar";
import type { ChatUserProfile } from "@/types/chat";

interface MentionInputProps {
  name: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  className?: string;
}

export interface MentionInputHandle {
  focus: () => void;
  clear: () => void;
}

type ActiveMode = "mention" | "hashtag" | null;

interface TagResult {
  id: string;
  name: string;
  count: number;
}

/**
 * A plain text input with @mention and #hashtag typeahead support.
 * Shows a dropdown of user suggestions when @ is typed,
 * or tag suggestions when # is typed.
 */
export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  function MentionInput({ name, placeholder, required, maxLength, className }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState("");
    const [query, setQuery] = useState<string | null>(null);
    const [mode, setMode] = useState<ActiveMode>(null);
    const [mentionResults, setMentionResults] = useState<ChatUserProfile[]>([]);
    const [tagResults, setTagResults] = useState<TagResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => setValue(""),
    }));

    const resultsCount = mode === "mention" ? mentionResults.length : tagResults.length;

    // Detect @mention or #hashtag query from input value and cursor position
    const detectTrigger = useCallback(() => {
      const input = inputRef.current;
      if (!input) return;

      const cursorPos = input.selectionStart ?? 0;
      const textBeforeCursor = value.slice(0, cursorPos);

      // Check for #hashtag first (so it takes priority if both match somehow)
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
    }, [value]);

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
      }, 300);

      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, [query, mode]);

    // Insert mention into the input value
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
      [value]
    );

    // Insert hashtag into the input value
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
      [value]
    );

    // Keyboard navigation
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (resultsCount === 0) return;

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % resultsCount);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + resultsCount) % resultsCount);
        } else if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          if (mode === "mention" && mentionResults[selectedIndex]) {
            insertMention(mentionResults[selectedIndex]);
          } else if (mode === "hashtag" && tagResults[selectedIndex]) {
            insertHashtag(tagResults[selectedIndex]);
          }
        } else if (e.key === "Escape") {
          setQuery(null);
          setMode(null);
          setMentionResults([]);
          setTagResults([]);
        }
      },
      [resultsCount, selectedIndex, insertMention, insertHashtag, mode, mentionResults, tagResults]
    );

    // Close dropdown on outside click
    useEffect(() => {
      if (resultsCount === 0) return;
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
    }, [resultsCount]);

    const isOpen = query !== null && resultsCount > 0;

    return (
      <>
        <input
          ref={inputRef}
          name={name}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          onInput={detectTrigger}
          onClick={detectTrigger}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          className={className}
          autoComplete="off"
          data-testid="mention-input"
        />
        {isOpen &&
          dropdownPos &&
          createPortal(
            <div
              ref={dropdownRef}
              className="max-h-52 w-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
              style={{
                position: "absolute",
                top: dropdownPos.top,
                left: dropdownPos.left,
                zIndex: 9999,
              }}
              role="listbox"
              aria-label={mode === "mention" ? "Mention suggestions" : "Tag suggestions"}
              data-testid="mention-dropdown"
            >
              {mode === "mention" &&
                mentionResults.map((user, index) => {
                  const avatarSrc = user.avatar || user.image;
                  const displayName =
                    user.displayName || user.name || user.username || "User";
                  return (
                    <button
                      key={user.id}
                      type="button"
                      role="option"
                      aria-selected={index === selectedIndex}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => insertMention(user)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        index === selectedIndex
                          ? "bg-zinc-100 dark:bg-zinc-700"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                      }`}
                      data-testid={`mention-option-${user.username}`}
                    >
                      <FramedAvatar
                        src={avatarSrc}
                        alt=""
                        initial={displayName[0]?.toUpperCase()}
                        size={32}
                        frameId={user.profileFrameId}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                          {displayName}
                        </div>
                        {user.username && (
                          <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                            @{user.username}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              {mode === "hashtag" &&
                tagResults.map((tag, index) => (
                  <button
                    key={tag.id}
                    type="button"
                    role="option"
                    aria-selected={index === selectedIndex}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => insertHashtag(tag)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      index === selectedIndex
                        ? "bg-zinc-100 dark:bg-zinc-700"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                    }`}
                    data-testid={`tag-option-${tag.name}`}
                  >
                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      #{tag.name}
                    </span>
                    <span className="ml-2 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {tag.count} {tag.count === 1 ? "post" : "posts"}
                    </span>
                  </button>
                ))}
            </div>,
            document.body
          )}
      </>
    );
  }
);
