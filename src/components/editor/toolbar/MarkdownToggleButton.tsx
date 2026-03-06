"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
} from "lexical";
import { $createCodeNode, $isCodeNode } from "@lexical/code";
import { useState } from "react";

export function MarkdownToggleButton() {
  const [editor] = useLexicalComposerContext();
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);

  function handleToggle() {
    if (isMarkdownMode) {
      // Markdown → Rich Text: read raw text from code block, convert back
      editor.update(() => {
        const root = $getRoot();
        const firstChild = root.getFirstChild();

        let markdownText = "";
        if ($isCodeNode(firstChild)) {
          markdownText = firstChild.getTextContent();
        } else {
          // Fallback: get all text
          markdownText = root.getTextContent();
        }

        root.clear();
        $convertFromMarkdownString(markdownText, TRANSFORMERS, undefined, true);
      });
      setIsMarkdownMode(false);
    } else {
      // Rich Text → Markdown: serialize to markdown, display in code block
      editor.update(() => {
        const markdown = $convertToMarkdownString(TRANSFORMERS);
        const root = $getRoot();
        root.clear();

        const codeNode = $createCodeNode("markdown");
        codeNode.append($createTextNode(markdown));
        root.append(codeNode);
      });
      setIsMarkdownMode(true);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`rounded px-1.5 py-1 text-xs font-bold transition-colors ${
        isMarkdownMode
          ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-100"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
      }`}
      aria-label={isMarkdownMode ? "Switch to rich text" : "Switch to markdown"}
      title={isMarkdownMode ? "Switch to rich text view" : "Switch to markdown source"}
    >
      M↓
    </button>
  );
}
