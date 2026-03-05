"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";

const theme = {
  paragraph: "mb-1",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
  },
};

interface PostContentProps {
  content: string;
}

export function PostContent({ content }: PostContentProps) {
  const editorConfig = {
    namespace: "PostContent",
    editable: false,
    editorState: content,
    theme,
    nodes: [HeadingNode, QuoteNode],
    onError: (error: Error) => console.error(error),
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
