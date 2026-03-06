"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection } from "lexical";
import { $patchStyleText, $getSelectionStyleValueForProperty } from "@lexical/selection";
import { useState, useRef, useEffect } from "react";

const PRESET_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#efefef", "#ffffff",
  "#ff0000", "#ff4d00", "#ff9900", "#ffcc00", "#ffff00", "#99ff00", "#00ff00",
  "#00ff99", "#00ffff", "#0099ff", "#0000ff", "#9900ff", "#ff00ff", "#ff0099",
  "#cc0000", "#cc3d00", "#cc7a00", "#cca300", "#cccc00", "#7acc00", "#00cc00",
  "#00cc7a", "#00cccc", "#007acc", "#0000cc", "#7a00cc", "#cc00cc", "#cc007a",
];

interface ColorPickerProps {
  type: "text" | "background";
}

export function ColorPicker({ type }: ColorPickerProps) {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(type === "text" ? "#000000" : "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function applyColor(value: string) {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (type === "text") {
          $patchStyleText(selection, { color: value || null });
        } else {
          $patchStyleText(selection, { "background-color": value || null });
        }
      }
    });
    setColor(value);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center rounded px-1.5 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
        aria-label={type === "text" ? "Text Color" : "Background Color"}
        title={type === "text" ? "Text Color" : "Background Color"}
      >
        {type === "text" ? (
          <span className="flex flex-col items-center">
            <span className="text-xs font-bold">A</span>
            <span className="mt-[-2px] h-1 w-4 rounded-sm" style={{ backgroundColor: color || "#000" }} />
          </span>
        ) : (
          <span className="flex flex-col items-center">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            <span className="mt-[-2px] h-1 w-4 rounded-sm" style={{ backgroundColor: color || "transparent" }} />
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="grid grid-cols-7 gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => applyColor(c)}
                className={`h-5 w-5 rounded border transition-transform hover:scale-110 ${
                  color === c ? "ring-2 ring-blue-500" : "border-zinc-300 dark:border-zinc-600"
                }`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1 border-t border-zinc-200 pt-2 dark:border-zinc-700">
            <input
              type="text"
              placeholder="#hex"
              className="w-20 rounded border border-zinc-300 bg-transparent px-1.5 py-0.5 text-xs dark:border-zinc-600"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value) {
                  applyColor(e.currentTarget.value);
                }
              }}
            />
            {color && (
              <button
                type="button"
                onClick={() => applyColor("")}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
