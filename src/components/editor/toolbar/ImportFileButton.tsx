"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
} from "lexical";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { $generateNodesFromDOM } from "@lexical/html";
import { useRef } from "react";

export function ImportFileButton() {
  const [editor] = useLexicalComposerContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      // Check if editor has content — confirm before replacing
      let hasContent = false;
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const text = root.getTextContent().trim();
        hasContent = text.length > 0;
      });

      if (hasContent) {
        const proceed = window.confirm(
          "This will replace the current editor content. Continue?"
        );
        if (!proceed) return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

      if (ext === "md" || ext === "markdown") {
        importMarkdown(content);
      } else if (ext === "html" || ext === "htm") {
        importHTML(content);
      } else {
        // Default: plain text
        importPlainText(content);
      }
    };

    reader.readAsText(file);

    // Reset so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function importMarkdown(md: string) {
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      $convertFromMarkdownString(md, TRANSFORMERS, undefined, true);
    });
  }

  function importHTML(html: string) {
    editor.update(() => {
      const root = $getRoot();
      root.clear();

      const parser = new DOMParser();
      const dom = parser.parseFromString(html, "text/html");
      const nodes = $generateNodesFromDOM(editor, dom);

      if (nodes.length > 0) {
        root.append(...nodes);
      } else {
        root.append($createParagraphNode());
      }
    });
  }

  function importPlainText(text: string) {
    editor.update(() => {
      const root = $getRoot();
      root.clear();

      const lines = text.split("\n");
      for (const line of lines) {
        const p = $createParagraphNode();
        if (line.trim()) {
          p.append($createTextNode(line));
        }
        root.append(p);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
        aria-label="Import file"
        title="Import file (.md, .txt, .html)"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt,.text,.html,.htm"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}
