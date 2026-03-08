"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ContentFlagsInfoModalProps {
  onClose: () => void;
}

export function ContentFlagsInfoModal({ onClose }: ContentFlagsInfoModalProps) {
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
            Adult and Sensitive Content Settings
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
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Sensitive</h3>
            <p>
              Content with detailed or graphic mentions of suicide or self harm,
              drug or substance use, violence, media depicting bodily harm, or
              anything you suspect of being harmful to a wider audience.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">NSFW</h3>
            <p>
              Content dealing with or depicting adult topics but not outright
              graphic adult material or sexualized nudity. Nudity in artwork,
              general photography does not need to be marked NSFW. Use good
              judgment.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Graphic/Nudity</h3>
            <p>
              Graphic descriptions of adult topics, media containing sexual acts,
              extreme violence, anything that is of great importance to be kept
              from minor or unwilling eyes.
            </p>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-700" />

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            <p>
              Only users who biometrically age verify can see posts marked
              Sensitive and Graphic/Nudity. All users can opt into NSFW content,
              but it will not be shown publicly to users who are not logged into
              the platform. This is for the safety of everyone, including minors
              who must not see adult content.
            </p>
            <p className="mt-2 font-medium text-red-600 dark:text-red-400">
              Three failures to mark material Sensitive or
              Graphic/Nudity according to the guidelines above will result in
              deactivation of your account.
            </p>
            <p className="mt-2">
              Please contact{" "}
              <a
                href="mailto:vibrantsocial@proton.me"
                className="text-zinc-700 underline dark:text-zinc-300"
              >
                vibrantsocial@proton.me
              </a>{" "}
              with any questions. Thank you for your cooperation in keeping our
              community safe.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
