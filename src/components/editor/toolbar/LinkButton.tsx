"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_CRITICAL } from "lexical";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { $findMatchingParent } from "@lexical/utils";
import { useEffect, useState, useCallback } from "react";

export function LinkButton() {
  const [editor] = useLexicalComposerContext();
  const [isLink, setIsLink] = useState(false);

  const updateLink = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const node = selection.anchor.getNode();
      const parent = node.getParent();
      if ($isLinkNode(parent) || $isLinkNode(node)) {
        setIsLink(true);
      } else {
        const matchingParent = $findMatchingParent(node, $isLinkNode);
        setIsLink(matchingParent !== null);
      }
    }
  }, []);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateLink();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
  }, [editor, updateLink]);

  function handleClick() {
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    } else {
      const url = prompt("Enter URL:");
      if (url) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`rounded px-1.5 py-1 text-sm transition-colors ${
        isLink
          ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-100"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
      }`}
      aria-label="Insert Link"
      title="Insert Link (Ctrl+K)"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    </button>
  );
}
