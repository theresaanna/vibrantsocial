"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import type { EditorState } from "lexical";

import { ClickableLinkPlugin } from "@lexical/react/LexicalClickableLinkPlugin";

import { editorTheme } from "./theme";
import { editorNodes } from "./nodes";
import { ReadOnlyChecklistPlugin } from "./plugins/ReadOnlyChecklistPlugin";
import { MentionLinkPlugin } from "./plugins/MentionLinkPlugin";
import { PostAuthorProvider } from "./PostAuthorContext";

interface EditorContentProps {
  content: string;
  /** When true, checkboxes are toggleable (for post authors). */
  allowChecklistToggle?: boolean;
  /** Called with updated Lexical JSON when a checkbox is toggled. */
  onContentChange?: (json: string) => void;
  /** When true, polls show results instead of voting UI. */
  isPostAuthor?: boolean;
}

function isLexicalJson(str: string): boolean {
  try {
    const parsed = JSON.parse(str);
    return parsed?.root?.type === "root";
  } catch {
    return false;
  }
}

/** Wrap a plain-text string in minimal Lexical JSON so it renders. */
function plainTextToLexical(text: string): string {
  return JSON.stringify({
    root: {
      children: text.split("\n").map((line) => ({
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: line,
            type: "text",
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
        textFormat: 0,
        textStyle: "",
      })),
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}

export function EditorContent({
  content,
  allowChecklistToggle = false,
  onContentChange,
  isPostAuthor = false,
}: EditorContentProps) {
  const editorState = isLexicalJson(content)
    ? content
    : plainTextToLexical(content);

  const editable = allowChecklistToggle;

  const editorConfig = {
    namespace: "VibrantContent",
    editable,
    editorState,
    theme: editorTheme,
    nodes: editorNodes,
    onError: (error: Error) => console.error("[EditorContent]", error),
  };

  function handleChange(state: EditorState) {
    if (onContentChange) {
      onContentChange(JSON.stringify(state.toJSON()));
    }
  }

  return (
    <PostAuthorProvider isPostAuthor={isPostAuthor}>
      <LexicalComposer initialConfig={editorConfig}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className={`text-[18px] text-zinc-900 outline-none dark:text-zinc-100${
                editable ? " cursor-default" : " cursor-default [&_*]:cursor-default [&_a]:cursor-pointer"
              }`}
              readOnly={!editable}
            />
          }
          placeholder={null}
          ErrorBoundary={({ children }) => <>{children}</>}
        />
        <ClickableLinkPlugin />
        <MentionLinkPlugin />
        {allowChecklistToggle && (
          <>
            <ListPlugin />
            <CheckListPlugin />
            <ReadOnlyChecklistPlugin />
            <OnChangePlugin onChange={handleChange} />
          </>
        )}
      </LexicalComposer>
    </PostAuthorProvider>
  );
}
