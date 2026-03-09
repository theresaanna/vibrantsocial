"use client";

import { useState, useEffect, useActionState } from "react";
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
import { createPost } from "@/app/feed/actions";
import Link from "next/link";

import { editorTheme } from "@/components/editor/theme";
import { editorNodes } from "@/components/editor/nodes";
import { Toolbar } from "@/components/editor/toolbar/Toolbar";
import { AutoLinkPlugin } from "@/components/editor/plugins/AutoLinkPlugin";
import { MentionsPlugin } from "@/components/editor/plugins/MentionsPlugin";
import { TagInput } from "@/components/tag-input";
import { ContentFlagsInfoModal } from "@/components/content-flags-info-modal";
import { DraftPlugin, clearDraft } from "@/components/editor/plugins/DraftPlugin";

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

interface PostComposerProps {
  phoneVerified: boolean;
  isOldEnough: boolean;
  onPostCreated?: (postId: string) => void;
}

export function PostComposer({ phoneVerified, isOldEnough, onPostCreated }: PostComposerProps) {
  const [editorJson, setEditorJson] = useState("");
  const [shouldClear, setShouldClear] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [isSensitive, setIsSensitive] = useState(false);
  const [isNsfw, setIsNsfw] = useState(false);
  const [isGraphicNudity, setIsGraphicNudity] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showContentWarnings, setShowContentWarnings] = useState(false);

  const [state, formAction, isPending] = useActionState(
    async (
      prevState: { success: boolean; message: string },
      formData: FormData
    ) => {
      const result = await createPost(prevState, formData);
      if (result.success) {
        setShouldClear(true);
        setEditorJson("");
        setTags([]);
        setIsSensitive(false);
        setIsNsfw(false);
        setIsGraphicNudity(false);
        clearDraft("compose");
        if (result.postId) onPostCreated?.(result.postId);
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

  if (!isOldEnough) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You must be 18 or older to create posts.
        </p>
      </div>
    );
  }

  const editorConfig = {
    namespace: "PostComposer",
    theme: editorTheme,
    nodes: editorNodes,
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
            <ListPlugin />
            <CheckListPlugin />
            <LinkPlugin />
            <AutoLinkPlugin />
            <HorizontalRulePlugin />
            <TablePlugin />
            <TabIndentationPlugin />
            <MentionsPlugin />
            <DraftPlugin draftKey="compose" />
          </div>
          <ClearOnSuccess
            shouldClear={shouldClear}
            onCleared={() => setShouldClear(false)}
          />
        </LexicalComposer>
        <TagInput
          tags={tags}
          onChange={setTags}
          disabled={isSensitive || isGraphicNudity}
          includeNsfw={isNsfw}
        />
        <input type="hidden" name="isGraphicNudity" value={isGraphicNudity ? "true" : "false"} />
        <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setShowContentWarnings(!showContentWarnings)}
            className="flex w-full items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            <svg className={`h-3.5 w-3.5 transition-transform ${showContentWarnings ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
            Content Warnings
          </button>
          {showContentWarnings && (
            <div className="mt-2 flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  name="isSensitive"
                  value="true"
                  className="rounded"
                  checked={isSensitive}
                  onChange={(e) => setIsSensitive(e.target.checked)}
                />
                Sensitive
              </label>
              <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  name="isNsfw"
                  value="true"
                  className="rounded"
                  checked={isNsfw}
                  onChange={(e) => setIsNsfw(e.target.checked)}
                />
                NSFW
              </label>
              <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  name="isGraphicNudity"
                  value="true"
                  className="rounded"
                  checked={isGraphicNudity}
                  onChange={(e) => setIsGraphicNudity(e.target.checked)}
                />
                Graphic/Explicit
              </label>
              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                className="ml-auto rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                title="Content flag guidelines"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {showInfoModal && <ContentFlagsInfoModal onClose={() => setShowInfoModal(false)} />}
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
