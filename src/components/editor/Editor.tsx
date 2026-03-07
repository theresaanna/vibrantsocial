"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, type EditorState } from "lexical";
import { useState, useCallback } from "react";

import { editorTheme } from "./theme";
import { editorNodes } from "./nodes";
import { Toolbar } from "./toolbar/Toolbar";
import { MentionsPlugin } from "./plugins/MentionsPlugin";

interface EditorProps {
  /** Initial content as Lexical JSON string */
  initialContent?: string | null;
  /** Called with JSON string on every change */
  onChange?: (json: string) => void;
  /** Name for hidden input (for form submission) */
  inputName?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Minimum height of content area */
  minHeight?: string;
}

/** Helper plugin that clears the editor programmatically */
export function ClearEditorPlugin({
  shouldClear,
  onCleared,
}: {
  shouldClear: boolean;
  onCleared: () => void;
}) {
  const [editor] = useLexicalComposerContext();

  if (shouldClear) {
    editor.update(() => {
      $getRoot().clear();
    });
    onCleared();
  }

  return null;
}

export function Editor({
  initialContent,
  onChange,
  inputName,
  placeholder = "Start writing...",
  minHeight = "120px",
}: EditorProps) {
  const [editorJson, setEditorJson] = useState(initialContent ?? "");

  // Try to use initialContent as Lexical JSON
  let editorState: string | undefined;
  if (initialContent) {
    try {
      const parsed = JSON.parse(initialContent);
      if (parsed?.root?.type === "root") {
        editorState = initialContent;
      }
    } catch {
      // Legacy plain-text — start with empty editor
    }
  }

  const handleChange = useCallback(
    (state: EditorState) => {
      const json = JSON.stringify(state.toJSON());
      setEditorJson(json);
      onChange?.(json);
    },
    [onChange]
  );

  const editorConfig = {
    namespace: "VibrantEditor",
    theme: editorTheme,
    nodes: editorNodes,
    editorState,
    onError: (error: Error) => console.error("[Editor]", error),
  };

  return (
    <div className="rounded-lg border border-zinc-300 dark:border-zinc-600">
      {inputName && <input type="hidden" name={inputName} value={editorJson} />}
      <LexicalComposer initialConfig={editorConfig}>
        <Toolbar />
        <div className="relative px-3 py-2 resize-y overflow-auto" style={{ minHeight }}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="outline-none text-sm text-zinc-900 dark:text-zinc-100 h-full"
              />
            }
            placeholder={
              <div
                className="pointer-events-none absolute left-3 top-2 text-sm text-zinc-400"
              >
                {placeholder}
              </div>
            }
            ErrorBoundary={({ children }) => <>{children}</>}
          />
          <OnChangePlugin onChange={handleChange} />
          <HistoryPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <LinkPlugin />
          <HorizontalRulePlugin />
          <TablePlugin />
          <TabIndentationPlugin />
          <MentionsPlugin />
        </div>
      </LexicalComposer>
    </div>
  );
}
