"use client";

import { useState, useEffect, useRef, useActionState } from "react";
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
import { createWallPost } from "@/app/feed/wall-post-actions";

import { editorTheme } from "@/components/editor/theme";
import { editorNodes } from "@/components/editor/nodes";
import { Toolbar } from "@/components/editor/toolbar/Toolbar";
import { AutoLinkPlugin } from "@/components/editor/plugins/AutoLinkPlugin";
import { MentionsPlugin } from "@/components/editor/plugins/MentionsPlugin";
import { HashtagPlugin } from "@/components/editor/plugins/HashtagPlugin";
import { HashtagLinkPlugin } from "@/components/editor/plugins/HashtagLinkPlugin";

function ClearOnSuccess({
  shouldClear,
  onCleared,
}: {
  shouldClear: boolean;
  onCleared: () => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (shouldClear) {
      editor.update(() => {
        $getRoot().clear();
      });
      onCleared();
    }
  }, [shouldClear, editor, onCleared]);

  return null;
}

interface WallPostComposerProps {
  wallOwnerId: string;
  wallOwnerName: string;
}

export function WallPostComposer({ wallOwnerId, wallOwnerName }: WallPostComposerProps) {
  const [content, setContent] = useState("");
  const [shouldClear, setShouldClear] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState(createWallPost, {
    success: false,
    message: "",
  });

  useEffect(() => {
    if (state.success) {
      setShouldClear(true);
      setContent("");
    }
  }, [state]);

  function handleChange(editorState: EditorState) {
    editorState.read(() => {
      setContent(JSON.stringify(editorState.toJSON()));
    });
  }

  const initialConfig = {
    namespace: "WallPostComposer",
    theme: editorTheme,
    nodes: editorNodes,
    onError: (error: Error) => {
      console.error("Lexical error:", error);
    },
  };

  return (
    <div className="rounded-2xl bg-white shadow-lg dark:bg-zinc-900" data-testid="wall-post-composer">
      <div className="flex items-center gap-2 rounded-t-2xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-4 py-2 dark:from-indigo-500/20 dark:to-purple-500/20">
        <svg className="h-4 w-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
        <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
          Write on {wallOwnerName}&apos;s wall
        </span>
      </div>
      <form ref={formRef} action={formAction} className="p-4">
        <input type="hidden" name="wallOwnerId" value={wallOwnerId} />
        <input type="hidden" name="content" value={content} />

        <LexicalComposer initialConfig={initialConfig}>
          <Toolbar />
          <div className="relative px-4 py-3">
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="min-h-[80px] text-sm text-zinc-900 outline-none dark:text-zinc-100" />
              }
              placeholder={
                <div className="pointer-events-none absolute left-4 top-3 text-sm text-zinc-400">
                  Write something on {wallOwnerName}&apos;s wall...
                </div>
              }
              ErrorBoundary={({ children }) => <>{children}</>}
            />
            <OnChangePlugin onChange={handleChange} />
            <HistoryPlugin />
            <ListPlugin />
            <CheckListPlugin />
            <LinkPlugin />
            <AutoLinkPlugin />
            <HorizontalRulePlugin />
            <TablePlugin />
            <TabIndentationPlugin />
            <MentionsPlugin />
            <HashtagPlugin />
            <HashtagLinkPlugin />
          </div>
          <ClearOnSuccess
            shouldClear={shouldClear}
            onCleared={() => setShouldClear(false)}
          />
        </LexicalComposer>

        {state.message && !state.success && (
          <p className="mt-2 text-sm text-red-500">{state.message}</p>
        )}
        {state.message && state.success && (
          <p className="mt-2 text-sm text-green-600">{state.message}</p>
        )}

        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={isPending || !content}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Posting..." : "Post to Wall"}
          </button>
        </div>
      </form>
    </div>
  );
}
