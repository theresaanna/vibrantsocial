"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { AutoTagButton } from "@/components/auto-tag-button";
import { ContentFlagsInfoModal } from "@/components/content-flags-info-modal";
import { PostContent } from "@/components/post-content";
import { timeAgo } from "@/lib/time";

interface QuotePostPageProps {
  postId: string;
  originalAuthor: string;
  originalAuthorDisplayName: string;
  originalAuthorAvatar: string | null;
  originalContent: string;
  originalCreatedAt: string;
}

export function QuotePostPage({
  postId,
  originalAuthor,
  originalAuthorDisplayName,
  originalAuthorAvatar,
  originalContent,
  originalCreatedAt,
}: QuotePostPageProps) {
  const router = useRouter();
  const [editorJson, setEditorJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [tags, setTags] = useState<string[]>([]);
  const [isSensitive, setIsSensitive] = useState(false);
  const [isNsfw, setIsNsfw] = useState(false);
  const [isGraphicNudity, setIsGraphicNudity] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isCloseFriendsOnly, setIsCloseFriendsOnly] = useState(false);
  const [showContentWarnings, setShowContentWarnings] = useState(false);

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
    formData.set("isCloseFriendsOnly", isCloseFriendsOnly ? "true" : "false");
    if (tags.length > 0) {
      formData.set("tags", tags.join(","));
    }

    startTransition(async () => {
      const result = await createQuoteRepost(
        { success: false, message: "" },
        formData
      );
      if (result.success) {
        router.push(`/post/${postId}`);
      } else {
        setError(result.message);
      }
    });
  };

  const editorConfig = {
    namespace: "QuoteComposer",
    theme: editorTheme,
    nodes: editorNodes,
    onError: (error: Error) => console.error(error),
  };

  const authorInitial = originalAuthorDisplayName[0]?.toUpperCase() ?? "?";

  return (
    <div>
      <Link
        href={`/post/${postId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
            clipRule="evenodd"
          />
        </svg>
        Back to post
      </Link>

      <div className="rounded-2xl bg-white shadow-lg dark:bg-zinc-900">
        <div className="p-5">
          <h1 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Quote Post
          </h1>

          {/* Editor */}
          <div
            data-testid="quote-editor"
            className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
          >
            <LexicalComposer initialConfig={editorConfig}>
              <Toolbar />
              <div className="relative px-3 py-2">
                <RichTextPlugin
                  contentEditable={
                    <ContentEditable className="min-h-[120px] text-sm text-zinc-900 outline-none dark:text-zinc-100" />
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
            <div className="flex items-center">
              <div className="flex-1">
                <TagInput
                  tags={tags}
                  onChange={setTags}
                  disabled={isSensitive || isGraphicNudity}
                  includeNsfw={isNsfw}
                />
              </div>
              {!(isSensitive || isGraphicNudity) && (
                <div className="pr-2">
                  <AutoTagButton
                    editorJson={editorJson}
                    existingTags={tags}
                    onTagsSuggested={setTags}
                  />
                </div>
              )}
            </div>
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
                      checked={isSensitive}
                      onChange={(e) => setIsSensitive(e.target.checked)}
                    />
                    Sensitive
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
              )}
            </div>
          </div>

          {showInfoModal && <ContentFlagsInfoModal onClose={() => setShowInfoModal(false)} />}

          {error && (
            <div className="mt-2 text-sm text-red-500">{error}</div>
          )}

          {/* Actions */}
          <div className="mt-4 flex items-center justify-end gap-2">
            <label
              className="flex cursor-pointer items-center gap-1.5 mr-auto"
              title="Only visible to your close friends"
            >
              <input
                type="checkbox"
                checked={isCloseFriendsOnly}
                onChange={(e) => setIsCloseFriendsOnly(e.target.checked)}
                className="sr-only peer"
              />
              <span className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${isCloseFriendsOnly ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400" : "border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:text-zinc-400"}`}>
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                </svg>
                Close Friends
              </span>
            </label>
            <Link
              href={`/post/${postId}`}
              className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
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

        {/* Original post preview */}
        <div className="border-t border-zinc-100 p-5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            {originalAuthorAvatar ? (
              <img
                src={originalAuthorAvatar}
                alt=""
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                {authorInitial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {originalAuthorDisplayName}
                </span>
                <span className="truncate text-sm text-zinc-500">
                  @{originalAuthor}
                </span>
              </div>
              <span className="text-xs text-zinc-400">
                {timeAgo(new Date(originalCreatedAt))}
              </span>
            </div>
          </div>
          <div className="mt-3">
            <PostContent content={originalContent} truncate={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
