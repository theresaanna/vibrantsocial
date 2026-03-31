"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface MarketplaceContentFlagsInfoModalProps {
  onClose: () => void;
}

export function MarketplaceContentFlagsInfoModal({ onClose }: MarketplaceContentFlagsInfoModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
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
            Marketplace Content Settings
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

        <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">NSFW</h3>
            <p>
              For listings with adult themes and nudity. Users must have NSFW
              content enabled in their settings to see these listings. This
              includes items like artistic nudity, lingerie, adult-themed
              artwork, and similar products.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Graphic/Explicit</h3>
            <p>
              For listings depicting sex acts, graphic depictions, or explicit
              adult content. Users must be age-verified to see these listings.
              This includes items like explicit artwork, adult toys, and similar
              products.
            </p>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-700" />

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            <p>
              Users must have NSFW content enabled in their settings to see NSFW
              marketplace listings. Users must be age-verified to see
              Graphic/Explicit marketplace listings.
            </p>
            <p className="mt-2 font-medium text-red-600 dark:text-red-400">
              No illegal items or materials are allowed under any circumstances.
            </p>
            <p className="mt-2 font-medium text-red-600 dark:text-red-400">
              Failure to mark adult material appropriately will result in removal
              of your listing and may lead to account suspension.
            </p>
            <p className="mt-2">
              Please contact{" "}
              <a
                href="mailto:vibrantsocial@proton.me"
                className="text-zinc-700 underline dark:text-zinc-300"
              >
                vibrantsocial@proton.me
              </a>{" "}
              with any questions.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
