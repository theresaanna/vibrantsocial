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
import { createPost } from "@/app/feed/actions";
import Link from "next/link";

import { editorTheme } from "@/components/editor/theme";
import { editorNodes } from "@/components/editor/nodes";
import { Toolbar } from "@/components/editor/toolbar/Toolbar";
import { AutoLinkPlugin } from "@/components/editor/plugins/AutoLinkPlugin";
import { MentionsPlugin } from "@/components/editor/plugins/MentionsPlugin";
import { HashtagPlugin } from "@/components/editor/plugins/HashtagPlugin";
import { HashtagLinkPlugin } from "@/components/editor/plugins/HashtagLinkPlugin";
import { TagInput } from "@/components/tag-input";
import { AutoTagButton } from "@/components/auto-tag-button";
import { ContentFlagsInfoModal } from "@/components/content-flags-info-modal";
import { AudiencePicker } from "@/components/audience-picker";
import { PremiumCrown } from "@/components/premium-crown";
import { DraftPlugin, ClearDraftButton, clearDraft, type DraftSaveStatus } from "@/components/editor/plugins/DraftPlugin";
import { extractFirstUrl } from "@/lib/lexical-text";
import { LinkPreviewCard } from "@/components/link-preview-card";

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
  isPremium?: boolean;
  isAgeVerified?: boolean;
  onPostCreated?: (postId: string) => void;
}

export function PostComposer({ phoneVerified, isOldEnough, isPremium, isAgeVerified, onPostCreated }: PostComposerProps) {
  const [editorJson, setEditorJson] = useState("");
  const [shouldClear, setShouldClear] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [isSensitive, setIsSensitive] = useState(false);
  const [isNsfw, setIsNsfw] = useState(false);
  const [isGraphicNudity, setIsGraphicNudity] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isCloseFriendsOnly, setIsCloseFriendsOnly] = useState(false);
  const [customAudienceIds, setCustomAudienceIds] = useState<string[]>([]);
  const [showAudiencePicker, setShowAudiencePicker] = useState(false);
  const [isLoggedInOnly, setIsLoggedInOnly] = useState(false);
  const [showContentWarnings, setShowContentWarnings] = useState(false);
  const [slug, setSlug] = useState("");
  const [showSlugInput, setShowSlugInput] = useState(false);
  const [draftStatus, setDraftStatus] = useState<DraftSaveStatus>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [previewStatus, setPreviewStatus] = useState<"loading" | "loaded" | "empty">("loading");
  const previewDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced URL extraction for live link preview
  useEffect(() => {
    if (previewDebounce.current) clearTimeout(previewDebounce.current);
    if (!editorJson) {
      setPreviewUrl(null);
      return;
    }
    previewDebounce.current = setTimeout(() => {
      const url = extractFirstUrl(editorJson);
      if (url !== previewUrl) setPreviewDismissed(false);
      setPreviewUrl(url);
    }, 500);
    return () => {
      if (previewDebounce.current) clearTimeout(previewDebounce.current);
    };
  }, [editorJson]);

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
        setIsCloseFriendsOnly(false);
        setCustomAudienceIds([]);
        setIsLoggedInOnly(false);
        setSlug("");
        setShowSlugInput(false);
        setScheduledFor("");
        setPreviewUrl(null);
        setPreviewDismissed(false);
        clearDraft("compose");
        if (result.postId && !formData.get("scheduledFor")) onPostCreated?.(result.postId);
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
    <div className="mb-6 rounded-2xl bg-white shadow-lg dark:bg-zinc-900">
      <form action={formAction}>
        <input type="hidden" name="content" value={editorJson} />
        <LexicalComposer initialConfig={editorConfig}>
          <Toolbar />
          <div className="relative px-4 py-3">
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="min-h-[80px] text-[18px] text-zinc-900 outline-none dark:text-zinc-100" />
              }
              placeholder={
                <div className="pointer-events-none absolute left-4 top-3 text-[18px] text-zinc-400">
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
            <HashtagPlugin />
            <HashtagLinkPlugin />
            <DraftPlugin draftKey="compose" onSaveStatusChange={setDraftStatus} />
          </div>
          <ClearOnSuccess
            shouldClear={shouldClear}
            onCleared={() => setShouldClear(false)}
          />
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-1.5 dark:border-zinc-700">
            <div className="flex items-center gap-2">
              {draftStatus === "saving" && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">Saving…</span>
              )}
              {draftStatus === "saved" && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">Saved</span>
              )}
            </div>
            <ClearDraftButton draftKey="compose" />
          </div>
        </LexicalComposer>
        {previewUrl && !previewDismissed && (
          <div className="relative border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
            {previewStatus === "loaded" && (
              <button
                type="button"
                onClick={() => setPreviewDismissed(true)}
                className="absolute top-3 right-5 z-10 rounded-full bg-zinc-100 p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                title="Dismiss link preview"
                data-testid="dismiss-link-preview"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <LinkPreviewCard url={previewUrl} onLoadChange={setPreviewStatus} />
          </div>
        )}
        <div className="flex min-h-[48px] items-center">
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
        <input type="hidden" name="hideLinkPreview" value={previewDismissed ? "true" : "false"} />
        {scheduledFor && <input type="hidden" name="scheduledFor" value={new Date(scheduledFor).toISOString()} />}
        <input type="hidden" name="isGraphicNudity" value={isGraphicNudity ? "true" : "false"} />
        <input type="hidden" name="isCloseFriendsOnly" value={isCloseFriendsOnly ? "true" : "false"} />
        <input type="hidden" name="hasCustomAudience" value={customAudienceIds.length > 0 ? "true" : "false"} />
        <input type="hidden" name="customAudienceIds" value={customAudienceIds.join(",")} />
        <input type="hidden" name="isLoggedInOnly" value={isLoggedInOnly ? "true" : "false"} />
        {!showSlugInput && <input type="hidden" name="slug" value={slug} />}
        <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setShowSlugInput(!showSlugInput)}
            className="flex w-full items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            <svg className={`h-3.5 w-3.5 transition-transform ${showSlugInput ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
            Custom URL
          </button>
          {showSlugInput && (
            <div className="mt-2">
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                URL slug (optional, auto-generated if empty)
              </label>
              <input
                type="text"
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-post-title"
                className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
                maxLength={60}
              />
            </div>
          )}
        </div>
        <ScheduleSection
          isPremium={!!isPremium}
          scheduledFor={scheduledFor}
          onChange={setScheduledFor}
        />
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
            <div className="mt-2 flex flex-wrap items-center gap-4">
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
              {isAgeVerified ? (
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
              ) : (
                <span className="flex items-center gap-1.5 text-sm text-zinc-400 dark:text-zinc-500">
                  <input type="checkbox" className="rounded opacity-50" disabled />
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  Sensitive
                  <Link href="/age-verify" className="text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400">(verify age)</Link>
                </span>
              )}
              {isAgeVerified ? (
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
              ) : (
                <span className="flex items-center gap-1.5 text-sm text-zinc-400 dark:text-zinc-500">
                  <input type="checkbox" className="rounded opacity-50" disabled />
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  Graphic/Explicit
                  <Link href="/age-verify" className="text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400">(verify age)</Link>
                </span>
              )}
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
          {showContentWarnings && isGraphicNudity && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              If the explicit media you post includes other people, you must be
              prepared to provide model release forms upon request.
            </p>
          )}
        </div>
        {showInfoModal && <ContentFlagsInfoModal onClose={() => setShowInfoModal(false)} />}
        {showAudiencePicker && (
          <AudiencePicker
            isOpen={showAudiencePicker}
            onClose={() => setShowAudiencePicker(false)}
            selectedIds={customAudienceIds}
            onSelectionChange={setCustomAudienceIds}
          />
        )}
        <div className="flex flex-col gap-2 border-t border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700">
          <div className="flex items-center gap-2">
            {state.message && !state.success && (
              <p className="text-sm text-red-600">{state.message}</p>
            )}
            {state.message && state.success && (
              <p className="text-sm text-green-600">{state.message}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label
              className="flex cursor-pointer items-center gap-1.5"
              title="Only visible to your close friends"
            >
              <input
                type="checkbox"
                checked={isCloseFriendsOnly}
                onChange={(e) => {
                  setIsCloseFriendsOnly(e.target.checked);
                  if (e.target.checked) setCustomAudienceIds([]);
                }}
                className="sr-only peer"
              />
              <span className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${isCloseFriendsOnly ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400" : "border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:text-zinc-400"}`}>
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                </svg>
                Close Friends
              </span>
            </label>
            <span className="relative flex items-center">
              <button
                type="button"
                disabled={!isPremium}
                onClick={() => {
                  setIsCloseFriendsOnly(false);
                  setShowAudiencePicker(true);
                }}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${customAudienceIds.length > 0 ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-400" : "border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:text-zinc-400"} ${customAudienceIds.length > 0 ? "rounded-r-none border-r-0" : ""} disabled:cursor-not-allowed disabled:opacity-50`}
                data-testid="custom-audience-button"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 8a3 3 0 100-6 3 3 0 000 6zm7.5 1a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
                </svg>
                {customAudienceIds.length > 0
                  ? `Custom Audience (${customAudienceIds.length})`
                  : "Custom Audience"}
              </button>
              {customAudienceIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCustomAudienceIds([])}
                  className="flex items-center rounded-full rounded-l-none border border-violet-300 bg-violet-50 px-1.5 py-1 text-violet-500 transition-colors hover:bg-violet-100 hover:text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-400 dark:hover:bg-violet-900/50"
                  title="Remove custom audience"
                  data-testid="clear-custom-audience"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <PremiumCrown href="/premium" />
            </span>
            <LoggedInOnlyToggle
              checked={isLoggedInOnly}
              onChange={setIsLoggedInOnly}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:from-fuchsia-500 hover:to-blue-500 disabled:opacity-50"
            >
              {isPending
                ? scheduledFor ? "Scheduling..." : "Posting..."
                : scheduledFor ? "Schedule" : "Post"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ScheduleSection({
  isPremium,
  scheduledFor,
  onChange,
}: {
  isPremium: boolean;
  scheduledFor: string;
  onChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Minimum datetime: 5 minutes from now, formatted for datetime-local input
  const minDate = new Date(Date.now() + 5 * 60_000);
  const minDateStr = minDate.toISOString().slice(0, 16);

  return (
    <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => isPremium && setExpanded(!expanded)}
          disabled={!isPremium}
          className="flex flex-1 items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-300"
          data-testid="schedule-toggle"
        >
          <svg className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 6v6l4 2" />
          </svg>
          {scheduledFor ? `Scheduled: ${new Date(scheduledFor).toLocaleString()}` : "Schedule"}
        </button>
        <PremiumCrown href="/premium" inline />
        {scheduledFor && (
          <button
            type="button"
            onClick={() => { onChange(""); setExpanded(false); }}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="Clear schedule"
            data-testid="clear-schedule"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {expanded && isPremium && (
        <div className="mt-2">
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => onChange(e.target.value)}
            min={minDateStr}
            className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500"
            data-testid="schedule-datetime"
          />
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Post will be published at this time
          </p>
        </div>
      )}
    </div>
  );
}

function LoggedInOnlyToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative flex items-center gap-1">
      <label
        className="flex cursor-pointer items-center gap-1.5"
        title="Only visible to logged-in users"
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <span
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${checked ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:text-zinc-400"}`}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          Logged-in Only
        </span>
      </label>
      <button
        type="button"
        onClick={() => setShowTooltip((prev) => !prev)}
        className="rounded-full p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        aria-label="Logged-in only info"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
        </svg>
      </button>
      {showTooltip && (
        <div className="absolute bottom-full right-0 z-20 mb-2 w-64 rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-600 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          <p>
            If you have a public profile, people outside Vibrant can see your
            posts unless they are marked with a content warning. Enabling this
            prevents people who are not logged in from seeing this post.
          </p>
          <button
            type="button"
            onClick={() => setShowTooltip(false)}
            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
