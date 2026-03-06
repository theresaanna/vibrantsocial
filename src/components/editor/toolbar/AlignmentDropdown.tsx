"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  FORMAT_ELEMENT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  type ElementFormatType,
} from "lexical";
import { DropdownMenu, DropdownItem } from "../ui/DropdownMenu";

const alignments: { label: string; format: ElementFormatType; icon: string }[] = [
  { label: "Left Align", format: "left", icon: "⫷" },
  { label: "Center Align", format: "center", icon: "⫸" },
  { label: "Right Align", format: "right", icon: "⫸" },
  { label: "Justify", format: "justify", icon: "☰" },
];

export function AlignmentDropdown() {
  const [editor] = useLexicalComposerContext();

  return (
    <DropdownMenu
      trigger={
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      }
    >
      {alignments.map((a) => (
        <DropdownItem
          key={a.format}
          label={a.label}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, a.format)}
        />
      ))}
      <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
      <DropdownItem
        label="Indent"
        onClick={() => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)}
      />
      <DropdownItem
        label="Outdent"
        onClick={() => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)}
      />
    </DropdownMenu>
  );
}
