"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  $getSelection,
  $isRangeSelection,
  type TextFormatType,
} from "lexical";
import { useEffect, useState, useCallback } from "react";

interface FormatButton {
  format: TextFormatType;
  label: string;
  ariaLabel: string;
  icon: React.ReactNode;
  shortcut: string;
  hideOnMobile?: boolean;
}

const formats: FormatButton[] = [
  {
    format: "bold",
    label: "B",
    ariaLabel: "Bold",
    shortcut: "Ctrl+B",
    icon: <span className="font-bold">B</span>,
  },
  {
    format: "italic",
    label: "I",
    ariaLabel: "Italic",
    shortcut: "Ctrl+I",
    icon: <span className="italic">I</span>,
  },
  {
    format: "underline",
    label: "U",
    ariaLabel: "Underline",
    shortcut: "Ctrl+U",
    icon: <span className="underline">U</span>,
  },
  {
    format: "strikethrough",
    label: "S",
    ariaLabel: "Strikethrough",
    shortcut: "Ctrl+Shift+X",
    hideOnMobile: true,
    icon: <span className="line-through">S</span>,
  },
];

const codeFormats: FormatButton[] = [
  {
    format: "subscript",
    label: "x₂",
    ariaLabel: "Subscript",
    shortcut: "",
    hideOnMobile: true,
    icon: (
      <span>
        x<sub className="text-[0.6em]">2</sub>
      </span>
    ),
  },
  {
    format: "superscript",
    label: "x²",
    ariaLabel: "Superscript",
    shortcut: "",
    hideOnMobile: true,
    icon: (
      <span>
        x<sup className="text-[0.6em]">2</sup>
      </span>
    ),
  },
  {
    format: "code",
    label: "<>",
    ariaLabel: "Inline Code",
    shortcut: "",
    hideOnMobile: true,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
];

function FormatButtonGroup({ buttons }: { buttons: FormatButton[] }) {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<Set<TextFormatType>>(new Set());

  const allFormats = [...formats, ...codeFormats];

  const updateFormats = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    const active = new Set<TextFormatType>();
    for (const f of allFormats) {
      if (selection.hasFormat(f.format)) active.add(f.format);
    }
    setActiveFormats(active);
  }, []);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateFormats();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
  }, [editor, updateFormats]);

  return (
    <>
      {buttons.map((f) => (
        <button
          key={f.format}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, f.format)}
          className={`rounded px-1.5 py-1 text-sm transition-colors ${f.hideOnMobile ? "hidden sm:inline-flex" : ""} ${
            activeFormats.has(f.format)
              ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-100"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
          aria-label={f.ariaLabel}
          title={f.shortcut ? `${f.ariaLabel} (${f.shortcut})` : f.ariaLabel}
        >
          {f.icon}
        </button>
      ))}
    </>
  );
}

export function TextFormatButtons() {
  return <FormatButtonGroup buttons={formats} />;
}

export function CodeFormatButtons() {
  return <FormatButtonGroup buttons={codeFormats} />;
}
