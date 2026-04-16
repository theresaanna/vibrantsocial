"use client";

import { createPortal } from "react-dom";
import { useModal } from "@/hooks/use-modal";

interface ContentFlagsInfoModalProps {
  onClose: () => void;
}

export function ContentFlagsInfoModal({ onClose }: ContentFlagsInfoModalProps) {
  useModal(true, onClose, { lockScroll: false });

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
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">NSFW</h3>
            <p>
              Talk of sexual topics and non-genital nudity.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Sensitive</h3>
            <p>
              Content with detailed or graphic mentions of suicide or self harm,
              drug or substance use, violence, media depicting bodily harm.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Graphic/Explicit</h3>
            <p>
              Genital nudity and sex acts.
            </p>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-700" />

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            <p>
              Only users who age verify can see posts marked Sensitive and
              Graphic/Explicit. All users can opt into NSFW content, but it will
              not be shown publicly to users who are not logged into the platform.
            </p>
            <p className="mt-2 font-medium text-red-600 dark:text-red-400">
              No illegal media or hate speech is allowed under any
              circumstances.
            </p>
            <p className="mt-2">
              We reserve the right to mark your media and even suspend your
              account if you are an egregious repeat offender who doesn&apos;t
              appear to be making an effort to keep the community safe.
            </p>
            <p className="mt-2">
              Please contact{" "}
              <a
                href="mailto:support@vibrantsocial.app"
                className="text-zinc-700 underline dark:text-zinc-300"
              >
                support@vibrantsocial.app
              </a>{" "}
              with any questions. Thank you for your cooperation.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
