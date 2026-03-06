"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useState } from "react";

export function LockButton() {
  const [editor] = useLexicalComposerContext();
  const [isLocked, setIsLocked] = useState(!editor.isEditable());

  useEffect(() => {
    return editor.registerEditableListener((editable) => {
      setIsLocked(!editable);
    });
  }, [editor]);

  function handleToggle() {
    const next = !isLocked;
    editor.setEditable(!next);
    setIsLocked(next);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`rounded p-1.5 transition-colors ${
        isLocked
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
      }`}
      aria-label={isLocked ? "Unlock editor" : "Lock editor"}
      title={isLocked ? "Unlock editor (read-only)" : "Lock editor (read-only)"}
    >
      {isLocked ? (
        /* Locked icon */
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      ) : (
        /* Unlocked icon */
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}
