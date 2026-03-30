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
import { createMarketplacePost } from "@/app/marketplace/actions";
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
import { MarketplaceContentFlagsInfoModal } from "@/components/marketplace-content-flags-info-modal";
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

interface MarketplacePostComposerProps {
  phoneVerified: boolean;
  isOldEnough: boolean;
  isAgeVerified?: boolean;
  isProfilePublic?: boolean;
  onPostCreated?: (postId: string) => void;
}

export function MarketplacePostComposer({
  phoneVerified,
  isOldEnough,
  isAgeVerified,
  isProfilePublic = true,
  onPostCreated,
}: MarketplacePostComposerProps) {
  const [editorJson, setEditorJson] = useState("");
  const [shouldClear, setShouldClear] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [isNsfw, setIsNsfw] = useState(false);
  const [isGraphicNudity, setIsGraphicNudity] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showContentWarnings, setShowContentWarnings] = useState(false);
  const [slug, setSlug] = useState("");
  const [showSlugInput, setShowSlugInput] = useState(false);
  const [draftStatus, setDraftStatus] = useState<DraftSaveStatus>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<"loading" | "loaded" | "empty">("loading");
  const previewDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Marketplace-specific fields
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [price, setPrice] = useState("");
  const [shippingOption, setShippingOption] = useState("CONTACT_SELLER");
  const [shippingPrice, setShippingPrice] = useState("");
  const [promotedToFeed, setPromotedToFeed] = useState(false);
  const [publicListing, setPublicListing] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

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
      const result = await createMarketplacePost(prevState, formData);
      if (result.success) {
        setShouldClear(true);
        setEditorJson("");
        setTags([]);
        setIsNsfw(false);
        setIsGraphicNudity(false);
        setSlug("");
        setShowSlugInput(false);
        setPreviewUrl(null);
        setPreviewDismissed(false);
        setPurchaseUrl("");
        setPrice("");
        setShippingOption("CONTACT_SELLER");
        setShippingPrice("");
        setPromotedToFeed(false);
        setPublicListing(false);
        setAgreedToTerms(false);
        clearDraft("marketplace-compose");
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
    namespace: "MarketplaceComposer",
    theme: editorTheme,
    nodes: editorNodes,
    onError: (error: Error) => console.error(error),
  };

  return (
    <div className="rounded-2xl bg-white shadow-lg dark:bg-zinc-900">
      <form action={formAction}>
        <input type="hidden" name="content" value={editorJson} />
        <input type="hidden" name="agreedToTerms" value={agreedToTerms ? "true" : "false"} />
        <LexicalComposer initialConfig={editorConfig}>
          <Toolbar />
          <div className="relative px-4 py-3">
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="min-h-[80px] text-sm text-zinc-900 outline-none dark:text-zinc-100" />
              }
              placeholder={
                <div className="pointer-events-none absolute left-4 top-3 text-sm text-zinc-400">
                  Describe your item for sale...
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
            <DraftPlugin draftKey="marketplace-compose" onSaveStatusChange={setDraftStatus} />
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
            <ClearDraftButton draftKey="marketplace-compose" />
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
              disabled={isGraphicNudity}
              includeNsfw={isNsfw}
            />
          </div>
          {!isGraphicNudity && (
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
        <input type="hidden" name="isGraphicNudity" value={isGraphicNudity ? "true" : "false"} />
        {!showSlugInput && <input type="hidden" name="slug" value={slug} />}

        {/* Marketplace fields */}
        <div className="space-y-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <svg className="h-4 w-4 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0020.01 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
            Listing Details
          </h3>
          <div>
            <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
              Purchase URL *
            </label>
            <input
              type="url"
              name="purchaseUrl"
              value={purchaseUrl}
              onChange={(e) => setPurchaseUrl(e.target.value)}
              placeholder="https://example.com/product"
              className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-pink-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-pink-500"
              required
              data-testid="marketplace-purchase-url"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">$</span>
                <input
                  type="number"
                  name="price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full rounded-md border border-zinc-200 py-1.5 pl-7 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-pink-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-pink-500"
                  required
                  data-testid="marketplace-price"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Shipping
              </label>
              <select
                name="shippingOption"
                value={shippingOption}
                onChange={(e) => setShippingOption(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-pink-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-pink-500"
                data-testid="marketplace-shipping"
              >
                <option value="CONTACT_SELLER">Contact Seller</option>
                <option value="FREE">Free Shipping</option>
                <option value="FLAT_RATE">Flat Rate</option>
              </select>
            </div>
          </div>
          {shippingOption === "FLAT_RATE" && (
            <div>
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Shipping Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">$</span>
                <input
                  type="number"
                  name="shippingPrice"
                  value={shippingPrice}
                  onChange={(e) => setShippingPrice(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full rounded-md border border-zinc-200 py-1.5 pl-7 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-pink-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-pink-500"
                  data-testid="marketplace-shipping-price"
                />
              </div>
            </div>
          )}
        </div>

        {/* Custom URL */}
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
                placeholder="my-listing-title"
                className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
                maxLength={60}
              />
            </div>
          )}
        </div>

        {/* Content warnings (NSFW + Graphic/Explicit, no Sensitive) */}
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
        {showInfoModal && <MarketplaceContentFlagsInfoModal onClose={() => setShowInfoModal(false)} />}

        {/* Promote to feed */}
        <input type="hidden" name="promotedToFeed" value={promotedToFeed ? "true" : "false"} />
        <input type="hidden" name="publicListing" value={publicListing ? "true" : "false"} />
        <div className="space-y-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={promotedToFeed}
              onChange={(e) => setPromotedToFeed(e.target.checked)}
              className="rounded"
              data-testid="marketplace-promote-checkbox"
            />
            <span>
              Promote to feed so friends and followers can see this listing
            </span>
          </label>
          {!isProfilePublic && (
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={publicListing}
                onChange={(e) => setPublicListing(e.target.checked)}
                className="rounded"
                data-testid="marketplace-public-listing-checkbox"
              />
              <span>
                Show this listing to visitors who aren&apos;t logged in
              </span>
            </label>
          )}
        </div>

        {/* Terms agreement */}
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 rounded"
              data-testid="marketplace-terms-checkbox"
            />
            <span>
              I confirm that I own the items listed for sale, they can be legally sold, and all adult material is marked appropriately.{" "}
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="text-pink-600 hover:text-pink-500 dark:text-pink-400"
              >
                Learn more
              </button>
            </span>
          </label>
        </div>
        {showTermsModal && <MarketplaceTermsModal onClose={() => setShowTermsModal(false)} />}

        <div className="flex flex-col gap-2 border-t border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700">
          <div className="flex items-center gap-2">
            {state.message && !state.success && (
              <p className="text-sm text-red-600">{state.message}</p>
            )}
            {state.message && state.success && (
              <p className="text-sm text-green-600">{state.message}</p>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending || !agreedToTerms}
              className="rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:from-pink-400 hover:to-rose-400 disabled:opacity-50"
              data-testid="marketplace-submit"
            >
              {isPending ? "Posting..." : "List for Sale"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function MarketplaceTermsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Marketplace Terms
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
          <p>By listing items on the VibrantSocial Marketplace, you agree to the following:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>You own or have the legal right to sell all items you list.</li>
            <li>All items can be legally sold in your jurisdiction.</li>
            <li>All adult-oriented material (nudity, explicit content) must be marked with the appropriate content warning (NSFW or Graphic/Explicit).</li>
            <li>VibrantSocial does not facilitate transactions directly. All purchases happen through your provided purchase URL.</li>
            <li>You are responsible for fulfilling orders and handling disputes with buyers.</li>
          </ul>
          <p className="font-medium text-red-600 dark:text-red-400">
            Failure to properly mark adult content will result in removal of your listing and may lead to account suspension.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-pink-500 px-4 py-2 text-sm font-medium text-white hover:bg-pink-400"
        >
          I Understand
        </button>
      </div>
    </div>
  );
}
