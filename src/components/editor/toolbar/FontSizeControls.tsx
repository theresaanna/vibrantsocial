"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_CRITICAL } from "lexical";
import { $patchStyleText, $getSelectionStyleValueForProperty } from "@lexical/selection";
import { useEffect, useState, useCallback } from "react";

const MIN_SIZE = 10;
const MAX_SIZE = 72;
const DEFAULT_SIZE = "18";

export function FontSizeControls() {
  const [editor] = useLexicalComposerContext();
  const [fontSize, setFontSize] = useState(DEFAULT_SIZE);
  const [inputValue, setInputValue] = useState(DEFAULT_SIZE);

  const updateSize = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const size = $getSelectionStyleValueForProperty(selection, "font-size", DEFAULT_SIZE + "px");
      const num = size.replace("px", "");
      setFontSize(num);
      setInputValue(num);
    }
  }, []);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateSize();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
  }, [editor, updateSize]);

  function applySize(size: number) {
    const clamped = Math.max(MIN_SIZE, Math.min(MAX_SIZE, size));
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { "font-size": `${clamped}px` });
      }
    });
    setFontSize(String(clamped));
    setInputValue(String(clamped));
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => applySize(Number(fontSize) - 1)}
        disabled={Number(fontSize) <= MIN_SIZE}
        className="rounded px-1 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-700"
        aria-label="Decrease font size"
      >
        −
      </button>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={() => {
          const num = parseInt(inputValue, 10);
          if (!isNaN(num)) applySize(num);
          else setInputValue(fontSize);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const num = parseInt(inputValue, 10);
            if (!isNaN(num)) applySize(num);
            else setInputValue(fontSize);
          }
        }}
        className="w-8 rounded border border-zinc-300 bg-transparent px-1 py-0.5 text-center text-xs text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
      />
      <button
        type="button"
        onClick={() => applySize(Number(fontSize) + 1)}
        disabled={Number(fontSize) >= MAX_SIZE}
        className="rounded px-1 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-700"
        aria-label="Increase font size"
      >
        +
      </button>
    </div>
  );
}
