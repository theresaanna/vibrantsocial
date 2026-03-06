"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";

import { editorTheme } from "./theme";
import { editorNodes } from "./nodes";

interface EditorContentProps {
  content: string;
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

export function EditorContent({ content }: EditorContentProps) {
  const editorState = isLexicalJson(content)
    ? content
    : plainTextToLexical(content);

  const editorConfig = {
    namespace: "VibrantContent",
    editable: false,
    editorState,
    theme: editorTheme,
    nodes: editorNodes,
    onError: (error: Error) => console.error("[EditorContent]", error),
  };

  return (
    <LexicalComposer initialConfig={editorConfig}>
      <RichTextPlugin
        contentEditable={
          <ContentEditable className="text-sm text-zinc-900 outline-none dark:text-zinc-100" />
        }
        placeholder={null}
        ErrorBoundary={({ children }) => <>{children}</>}
      />
    </LexicalComposer>
  );
}
