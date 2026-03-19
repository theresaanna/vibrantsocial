"use client";

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { searchUsers } from "@/app/chat/actions";
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
}

/**
 * A plain text input with @mention typeahead support.
 * Shows a dropdown of user suggestions when @ is typed.
 */
export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  function MentionInput({ name, placeholder, required, maxLength, className }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState("");
    const [query, setQuery] = useState<string | null>(null);
    const [results, setResults] = useState<ChatUserProfile[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    // Detect @mention query from input value and cursor position
    const detectMention = useCallback(() => {
      const input = inputRef.current;
      if (!input) return;

      const cursorPos = input.selectionStart ?? 0;
      const textBeforeCursor = value.slice(0, cursorPos);
      const match = textBeforeCursor.match(/(?:^|[\s])@([\w]*)$/);

      if (match) {
        setQuery(match[1]);

        // Position dropdown near input
        const rect = input.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      } else {
        setQuery(null);
        setResults([]);
      }
    }, [value]);

    // Search users when query changes
    useEffect(() => {
      if (query === null || query.length < 1) {
        setResults([]);
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        const users = await searchUsers(query);
        setResults(users.filter((u) => u.username));
        setSelectedIndex(0);
      }, 300);

      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, [query]);

    // Insert mention into the input value
    const insertMention = useCallback(
      (user: ChatUserProfile) => {
        const input = inputRef.current;
        if (!input) return;

        const cursorPos = input.selectionStart ?? 0;
        const textBeforeCursor = value.slice(0, cursorPos);
        const textAfterCursor = value.slice(cursorPos);

        // Find the @query to replace
        const match = textBeforeCursor.match(/(?:^|([\s]))@[\w]*$/);
        if (!match) return;

        const atIndex = textBeforeCursor.lastIndexOf("@");
        const beforeAt = value.slice(0, atIndex);
        const mention = `@${user.username} `;
        const newValue = beforeAt + mention + textAfterCursor;

        setValue(newValue);
        setQuery(null);
        setResults([]);

        // Restore cursor position after React re-render
        const newCursorPos = beforeAt.length + mention.length;
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
        if (results.length === 0) return;

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % results.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + results.length) % results.length);
        } else if (e.key === "Enter" || e.key === "Tab") {
          if (results[selectedIndex]) {
            e.preventDefault();
            insertMention(results[selectedIndex]);
          }
        } else if (e.key === "Escape") {
          setQuery(null);
          setResults([]);
        }
      },
      [results, selectedIndex, insertMention]
    );

    // Close dropdown on outside click
    useEffect(() => {
      if (results.length === 0) return;
      function handleClick(e: MouseEvent) {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current &&
          !inputRef.current.contains(e.target as Node)
        ) {
          setQuery(null);
          setResults([]);
        }
      }
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [results.length]);

    const isOpen = query !== null && results.length > 0;

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
          onInput={detectMention}
          onClick={detectMention}
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
              aria-label="Mention suggestions"
              data-testid="mention-dropdown"
            >
              {results.map((user, index) => {
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
            </div>,
            document.body
          )}
      </>
    );
  }
);
