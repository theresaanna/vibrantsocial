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
import { searchTags } from "@/app/tags/actions";
import { $createHashtagNode } from "../nodes/HashtagNode";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function getHashtagMatch(
  anchorNode: TextNode,
  anchorOffset: number
): { query: string; matchStart: number } | null {
  const text = anchorNode.getTextContent().slice(0, anchorOffset);
  const match = text.match(/(?:^|[\s])#([\w-]*)$/);
  if (!match) return null;
  const query = match[1];
  const matchStart = text.length - query.length - 1; // -1 for the '#'
  return { query, matchStart };
}

function getCursorRect(editor: LexicalEditor): DOMRect | null {
  const nativeSelection = window.getSelection();
  if (nativeSelection && nativeSelection.rangeCount > 0) {
    const range = nativeSelection.getRangeAt(0);
    const rangeRect = range.getBoundingClientRect();
    if (rangeRect.height > 0 && rangeRect.bottom > 0) return rangeRect;
    const rects = range.getClientRects();
    if (rects.length > 0 && rects[0].height > 0) return rects[0];
  }
  const rootEl = editor.getRootElement();
  return rootEl ? rootEl.getBoundingClientRect() : null;
}

interface TagResult {
  id: string;
  name: string;
  count: number;
}

interface HashtagDropdownProps {
  results: TagResult[];
  selectedIndex: number;
  editor: LexicalEditor;
  onSelect: (tag: TagResult) => void;
}

function HashtagDropdown({
  results,
  selectedIndex,
  editor,
  onSelect,
}: HashtagDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  if (results.length === 0) return null;

  const anchorRect = getCursorRect(editor);
  if (!anchorRect) return null;

  const dropdownWidth = 256;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  const viewportWidth = window.innerWidth;
  let left: number;
  if (anchorRect.left > viewportWidth / 2) {
    left = Math.max(scrollX + 8, anchorRect.right + scrollX - dropdownWidth);
  } else {
    left = Math.max(scrollX + 8, Math.min(anchorRect.left + scrollX, scrollX + viewportWidth - dropdownWidth - 8));
  }

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
      aria-label="Tag suggestions"
      onPointerDown={(e) => e.preventDefault()}
    >
      {results.map((tag, index) => (
        <button
          key={tag.id}
          type="button"
          role="option"
          aria-selected={index === selectedIndex}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onSelect(tag)}
          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
            index === selectedIndex
              ? "bg-zinc-100 dark:bg-zinc-700"
              : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
          }`}
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
  );
}

export function HashtagPlugin() {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<TagResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const debouncedQuery = useDebounce(query, 300);

  // Search tags when query changes
  useEffect(() => {
    if (debouncedQuery === null || debouncedQuery.length < 1) {
      setResults([]);
      return;
    }

    let cancelled = false;
    searchTags(debouncedQuery).then((tags) => {
      if (!cancelled) {
        setResults(tags);
        setSelectedIndex(0);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const insertHashtag = useCallback(
    (tag: TagResult) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchorNode = selection.anchor.getNode();
        if (!$isTextNode(anchorNode)) return;

        const text = anchorNode.getTextContent();
        const anchorOffset = selection.anchor.offset;

        const beforeCursor = text.slice(0, anchorOffset);
        const hashMatch = beforeCursor.match(/(?:^|[\s])#([\w-]*)$/);
        if (!hashMatch) return;

        const queryLength = hashMatch[1].length;
        const hashIndex = anchorOffset - queryLength - 1;

        const hashtagNode = $createHashtagNode(tag.name);

        if (hashIndex > 0) {
          const [beforeNode] = anchorNode.splitText(hashIndex, anchorOffset);
          const afterNode = beforeNode.getNextSibling();
          if (afterNode && $isTextNode(afterNode)) {
            afterNode.replace(hashtagNode);
          }
        } else {
          if (anchorOffset < text.length) {
            const [queryNode] = anchorNode.splitText(anchorOffset);
            queryNode.replace(hashtagNode);
          } else {
            anchorNode.replace(hashtagNode);
          }
        }

        hashtagNode.selectNext();
      });

      setQuery(null);
      setResults([]);
    },
    [editor]
  );

  // Listen for text changes to detect #hashtags
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

        const match = getHashtagMatch(anchorNode, selection.anchor.offset);
        if (match) {
          setQuery(match.query);
        } else {
          setQuery(null);
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
        const tag = results[selectedIndex];
        if (tag) insertHashtag(tag);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    const removeTab = editor.registerCommand(
      KEY_TAB_COMMAND,
      (e) => {
        e?.preventDefault();
        const tag = results[selectedIndex];
        if (tag) insertHashtag(tag);
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
  }, [editor, results, selectedIndex, insertHashtag]);

  const isOpen = query !== null && results.length > 0;

  if (!isOpen) return null;

  return (
    <HashtagDropdown
      results={results}
      selectedIndex={selectedIndex}
      editor={editor}
      onSelect={insertHashtag}
    />
  );
}
