"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  COMMAND_PRIORITY_HIGH,
  type LexicalEditor,
  type TextNode,
} from "lexical";
import { createPortal } from "react-dom";
import { searchUsers } from "@/app/chat/actions";
import type { ChatUserProfile } from "@/types/chat";
import { $createMentionNode } from "../nodes/MentionNode";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

/**
 * Checks for an active @mention query at the current cursor position.
 * Returns the query string (without @) and the TextNode + offset info,
 * or null if no @query is active.
 */
function getMentionMatch(
  anchorNode: TextNode,
  anchorOffset: number
): { query: string; matchStart: number } | null {
  const text = anchorNode.getTextContent().slice(0, anchorOffset);
  // Find the last '@' that is either at start of text or preceded by a space/newline
  const match = text.match(/(?:^|[\s])@([\w]*)$/);
  if (!match) return null;
  const query = match[1];
  // matchStart is the index of '@' in the text content
  const matchStart = text.length - query.length - 1; // -1 for the '@'
  return { query, matchStart };
}

/**
 * Reads the current cursor rect from the DOM, with fallbacks for mobile
 * browsers that return all-zero rects for collapsed ranges.
 */
function getCursorRect(editor: LexicalEditor): DOMRect | null {
  const nativeSelection = window.getSelection();
  if (nativeSelection && nativeSelection.rangeCount > 0) {
    const range = nativeSelection.getRangeAt(0);
    const rangeRect = range.getBoundingClientRect();
    if (rangeRect.height > 0 && rangeRect.bottom > 0) return rangeRect;
    // getClientRects() sometimes works when getBoundingClientRect doesn't
    const rects = range.getClientRects();
    if (rects.length > 0 && rects[0].height > 0) return rects[0];
  }
  // Fallback: editor root element
  const rootEl = editor.getRootElement();
  return rootEl ? rootEl.getBoundingClientRect() : null;
}

interface MentionDropdownProps {
  results: ChatUserProfile[];
  selectedIndex: number;
  editor: LexicalEditor;
  onSelect: (user: ChatUserProfile) => void;
}

function MentionDropdown({
  results,
  selectedIndex,
  editor,
  onSelect,
}: MentionDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  if (results.length === 0) return null;

  // Compute position from current DOM state (not a stored rect)
  const anchorRect = getCursorRect(editor);
  if (!anchorRect) return null;

  const dropdownWidth = 256; // w-64

  // Convert viewport-relative rect to document-relative coordinates
  // so the dropdown scrolls with the page (fixes iOS keyboard issues)
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  // Horizontal: if cursor is past the midpoint, align right edge near cursor
  const viewportWidth = window.innerWidth;
  let left: number;
  if (anchorRect.left > viewportWidth / 2) {
    left = Math.max(scrollX + 8, anchorRect.right + scrollX - dropdownWidth);
  } else {
    left = Math.max(scrollX + 8, Math.min(anchorRect.left + scrollX, scrollX + viewportWidth - dropdownWidth - 8));
  }

  // Vertical: place below the anchor
  const top = anchorRect.bottom + scrollY + 4;

  const style: React.CSSProperties = {
    position: "absolute",
    top,
    left,
    zIndex: 9999,
  };

  return createPortal(
    <div
      ref={dropdownRef}
      style={style}
      className="max-h-52 w-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
      role="listbox"
      aria-label="Mention suggestions"
      onPointerDown={(e) => e.preventDefault()}
    >
      {results.map((user, index) => {
        const avatarSrc = user.avatar || user.image;
        const displayName = user.displayName || user.name || user.username || "User";
        return (
          <button
            key={user.id}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onSelect(user)}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
              index === selectedIndex
                ? "bg-zinc-100 dark:bg-zinc-700"
                : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
            }`}
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-600 dark:text-zinc-300">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
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
  );
}

export function MentionsPlugin() {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<ChatUserProfile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const matchInfoRef = useRef<{ matchStart: number } | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Search users when query changes
  useEffect(() => {
    if (debouncedQuery === null || debouncedQuery.length < 1) {
      setResults([]);
      return;
    }

    let cancelled = false;
    searchUsers(debouncedQuery).then((users) => {
      if (!cancelled) {
        // Only show users with usernames
        setResults(users.filter((u) => u.username));
        setSelectedIndex(0);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const insertMention = useCallback(
    (user: ChatUserProfile) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchorNode = selection.anchor.getNode();
        if (!$isTextNode(anchorNode)) return;

        const text = anchorNode.getTextContent();
        const anchorOffset = selection.anchor.offset;

        // Find the '@' position
        const beforeCursor = text.slice(0, anchorOffset);
        const atMatch = beforeCursor.match(/(?:^|[\s])@([\w]*)$/);
        if (!atMatch) return;

        const queryLength = atMatch[1].length;
        const atIndex = anchorOffset - queryLength - 1;

        // Split the text node at the @ position
        // We need to remove "@query" and insert the MentionNode
        const mentionNode = $createMentionNode(user.username!, user.id);

        if (atIndex > 0) {
          // There's text before the @
          const [beforeNode] = anchorNode.splitText(atIndex, anchorOffset);
          const afterNode = beforeNode.getNextSibling();
          if (afterNode && $isTextNode(afterNode)) {
            afterNode.replace(mentionNode);
          }
        } else {
          // @ is at the start
          if (anchorOffset < text.length) {
            // There's text after the query
            const [queryNode] = anchorNode.splitText(anchorOffset);
            queryNode.replace(mentionNode);
          } else {
            // The entire node is the query
            anchorNode.replace(mentionNode);
          }
        }

        // Insert a space after the mention
        mentionNode.selectNext();
      });

      setQuery(null);
      setResults([]);
    },
    [editor]
  );

  // Listen for text changes to detect @mentions
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          setQuery(null);
          return;
        }

        const anchorNode = selection.anchor.getNode();
        if (!$isTextNode(anchorNode)) {
          setQuery(null);
          return;
        }

        const match = getMentionMatch(anchorNode, selection.anchor.offset);
        if (match) {
          setQuery(match.query);
          matchInfoRef.current = { matchStart: match.matchStart };
        } else {
          setQuery(null);
          matchInfoRef.current = null;
        }
      });
    });
  }, [editor]);

  // Keyboard navigation
  useEffect(() => {
    if (results.length === 0) return;

    const removeDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (e) => {
        e?.preventDefault();
        setSelectedIndex((i) => (i + 1) % results.length);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    const removeUp = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (e) => {
        e?.preventDefault();
        setSelectedIndex((i) => (i - 1 + results.length) % results.length);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    const removeEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (e) => {
        e?.preventDefault();
        const user = results[selectedIndex];
        if (user) insertMention(user);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    const removeTab = editor.registerCommand(
      KEY_TAB_COMMAND,
      (e) => {
        e?.preventDefault();
        const user = results[selectedIndex];
        if (user) insertMention(user);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    const removeEsc = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        setQuery(null);
        setResults([]);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    return () => {
      removeDown();
      removeUp();
      removeEnter();
      removeTab();
      removeEsc();
    };
  }, [editor, results, selectedIndex, insertMention]);

  const isOpen = query !== null && results.length > 0;

  if (!isOpen) return null;

  return (
    <MentionDropdown
      results={results}
      selectedIndex={selectedIndex}
      editor={editor}
      onSelect={insertMention}
    />
  );
}
