"use client";

import { useState, useActionState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import {
  FORMAT_TEXT_COMMAND,
  type EditorState,
  $getRoot,
} from "lexical";
import { createPost } from "@/app/feed/actions";
import Link from "next/link";

const theme = {
  paragraph: "mb-1",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
  },
};

function Toolbar() {
  const [editor] = useLexicalComposerContext();

  return (
    <div className="flex gap-1 border-b border-zinc-200 px-2 py-1 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
        className="rounded px-2 py-1 text-sm font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
        className="rounded px-2 py-1 text-sm italic text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        I
      </button>
      <button
        type="button"
        onClick={() =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")
        }
        className="rounded px-2 py-1 text-sm text-zinc-600 underline hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        U
      </button>
    </div>
  );
}

function ClearOnSuccess({
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

interface PostComposerProps {
  phoneVerified: boolean;
}

export function PostComposer({ phoneVerified }: PostComposerProps) {
  const [editorJson, setEditorJson] = useState("");
  const [shouldClear, setShouldClear] = useState(false);

  const [state, formAction, isPending] = useActionState(
    async (
      prevState: { success: boolean; message: string },
      formData: FormData
    ) => {
      const result = await createPost(prevState, formData);
      if (result.success) {
        setShouldClear(true);
        setEditorJson("");
      }
      return result;
    },
    { success: false, message: "" }
  );

  function handleChange(editorState: EditorState) {
    setEditorJson(JSON.stringify(editorState.toJSON()));
  }

  if (!phoneVerified) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href="/verify-phone"
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Verify your phone number
          </Link>{" "}
          to start posting.
        </p>
      </div>
    );
  }

  const editorConfig = {
    namespace: "PostComposer",
    theme,
    nodes: [HeadingNode, QuoteNode],
    onError: (error: Error) => console.error(error),
  };

  return (
    <div className="rounded-2xl bg-white shadow-lg dark:bg-zinc-900">
      <form action={formAction}>
        <input type="hidden" name="content" value={editorJson} />
        <LexicalComposer initialConfig={editorConfig}>
          <Toolbar />
          <div className="relative px-4 py-3">
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="min-h-[80px] text-sm text-zinc-900 outline-none dark:text-zinc-100" />
              }
              placeholder={
                <div className="pointer-events-none absolute left-4 top-3 text-sm text-zinc-400">
                  What&apos;s on your mind?
                </div>
              }
              ErrorBoundary={({ children }) => <>{children}</>}
            />
            <OnChangePlugin onChange={handleChange} />
            <HistoryPlugin />
          </div>
          <ClearOnSuccess
            shouldClear={shouldClear}
            onCleared={() => setShouldClear(false)}
          />
        </LexicalComposer>
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          {state.message && !state.success && (
            <p className="text-sm text-red-600">{state.message}</p>
          )}
          {state.message && state.success && (
            <p className="text-sm text-green-600">{state.message}</p>
          )}
          {!state.message && <span />}
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? "Posting..." : "Post"}
          </button>
        </div>
      </form>
    </div>
  );
}
