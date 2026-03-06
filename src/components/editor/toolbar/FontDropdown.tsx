"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_CRITICAL } from "lexical";
import { $patchStyleText, $getSelectionStyleValueForProperty } from "@lexical/selection";
import { useEffect, useState, useCallback } from "react";
import { DropdownMenu, DropdownItem } from "../ui/DropdownMenu";

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
];

export function FontDropdown() {
  const [editor] = useLexicalComposerContext();
  const [fontFamily, setFontFamily] = useState("");

  const updateFont = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setFontFamily($getSelectionStyleValueForProperty(selection, "font-family", ""));
    }
  }, []);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateFont();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
  }, [editor, updateFont]);

  function applyFont(value: string) {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { "font-family": value || null });
      }
    });
  }

  const currentLabel = FONT_FAMILIES.find((f) => f.value === fontFamily)?.label ?? "Font";

  return (
    <DropdownMenu trigger={<span className="min-w-[70px] text-left text-xs">{currentLabel}</span>}>
      {FONT_FAMILIES.map((f) => (
        <DropdownItem
          key={f.label}
          label={f.label}
          active={fontFamily === f.value}
          onClick={() => applyFont(f.value)}
        />
      ))}
    </DropdownMenu>
  );
}
