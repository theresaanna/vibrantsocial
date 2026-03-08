"use client";

import { useState, useTransition } from "react";
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
import type { EditorState } from "lexical";
import { createQuoteRepost } from "@/app/feed/post-actions";

import { editorTheme } from "@/components/editor/theme";
import { editorNodes } from "@/components/editor/nodes";
import { Toolbar } from "@/components/editor/toolbar/Toolbar";
import { AutoLinkPlugin } from "@/components/editor/plugins/AutoLinkPlugin";
import { MentionsPlugin } from "@/components/editor/plugins/MentionsPlugin";
import { TagInput } from "@/components/tag-input";
import { ContentFlagsInfoModal } from "@/components/content-flags-info-modal";

interface QuotePostModalProps {
  postId: string;
  originalAuthor: string;
  originalContent: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function QuotePostModal({
  postId,
  originalAuthor,
  originalContent,
  onClose,
  onSuccess,
}: QuotePostModalProps) {
  const [editorJson, setEditorJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [tags, setTags] = useState<string[]>([]);
  const [isSensitive, setIsSensitive] = useState(false);
  const [isNsfw, setIsNsfw] = useState(false);
  const [isGraphicNudity, setIsGraphicNudity] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  function handleChange(editorState: EditorState) {
    setEditorJson(JSON.stringify(editorState.toJSON()));
    setError(null);
  }

  const hasContent = editorJson.length >= 50;

  const handleSubmit = () => {
    if (!hasContent || pending) return;

    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("content", editorJson);
    formData.set("isSensitive", isSensitive ? "true" : "false");
    formData.set("isNsfw", isNsfw ? "true" : "false");
    formData.set("isGraphicNudity", isGraphicNudity ? "true" : "false");
    if (tags.length > 0) {
      formData.set("tags", tags.join(","));
    }

    startTransition(async () => {
      const result = await createQuoteRepost({ success: false, message: "" }, formData);
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.message);
      }
    });
  };

  // Parse original content for preview (handle Lexical JSON)
  let previewText = originalContent;
  try {
    const parsed = JSON.parse(originalContent);
    if (parsed?.root?.children) {
      previewText = parsed.root.children
        .map((node: { children?: Array<{ text?: string }> }) =>
          node.children?.map((c: { text?: string }) => c.text || "").join("") || ""
        )
        .filter(Boolean)
        .join("\n");
    }
  } catch {
    // Plain text content
  }

  const editorConfig = {
    namespace: "QuoteComposer",
    theme: editorTheme,
    nodes: editorNodes,
    onError: (error: Error) => console.error(error),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Quote Post
        </h2>

        <div data-testid="quote-editor" className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
          <LexicalComposer initialConfig={editorConfig}>
            <Toolbar />
            <div className="relative px-3 py-2">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable className="min-h-[80px] text-sm text-zinc-900 outline-none dark:text-zinc-100" />
                }
                placeholder={
                  <div className="pointer-events-none absolute left-3 top-2 text-sm text-zinc-400">
                    Add your commentary...
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
            </div>
          </LexicalComposer>
          <TagInput
            tags={tags}
            onChange={setTags}
            disabled={isSensitive || isGraphicNudity}
            includeNsfw={isNsfw}
          />
          <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={isSensitive}
                  onChange={(e) => setIsSensitive(e.target.checked)}
                />
                Sensitive
              </label>
              <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={isNsfw}
                  onChange={(e) => setIsNsfw(e.target.checked)}
                />
                NSFW
              </label>
              <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
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
          </div>
        </div>

        {showInfoModal && <ContentFlagsInfoModal onClose={() => setShowInfoModal(false)} />}

        {error && (
          <div className="mt-1 text-xs text-red-500">{error}</div>
        )}

        {/* Original post preview */}
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            @{originalAuthor}
          </p>
          <p className="mt-1 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-300">
            {previewText.substring(0, 200)}
            {previewText.length > 200 && "..."}
          </p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!hasContent || pending}
            className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
            data-testid="quote-submit"
          >
            {pending ? "Posting..." : "Quote Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
