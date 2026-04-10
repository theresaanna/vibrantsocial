"use client";

import { useActionState, useRef } from "react";
import { createPortal } from "react-dom";
import { useModal } from "@/hooks/use-modal";
import { submitReport, type ReportState } from "@/app/report/actions";
import Link from "next/link";

interface ReportModalProps {
  contentType: "post" | "comment" | "profile" | "conversation";
  contentId: string;
  isOpen: boolean;
  onClose: () => void;
}

const LABELS: Record<string, string> = {
  post: "Report Post",
  comment: "Report Comment",
  profile: "Report Profile",
  conversation: "Report Conversation",
};

export function ReportModal({ contentType, contentId, isOpen, onClose }: ReportModalProps) {
  const [state, formAction, isPending] = useActionState<ReportState, FormData>(submitReport, {
    success: false,
    message: "",
  });
  const overlayRef = useRef<HTMLDivElement>(null);

  useModal(isOpen, onClose, { lockScroll: false });

  if (!isOpen) return null;

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      data-testid="report-modal-overlay"
    >
      <div className="mx-4 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {LABELS[contentType]}
        </h2>

        {state.success ? (
          <div data-testid="report-success">
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              {state.message}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              data-testid="report-close-button"
            >
              Close
            </button>
          </div>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="contentType" value={contentType} />
            <input type="hidden" name="contentId" value={contentId} />

            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Please describe the issue. Review our{" "}
              <Link href="/tos" className="underline hover:text-zinc-700 dark:hover:text-zinc-200" target="_blank">
                Terms of Service
              </Link>{" "}
              for reference.
            </p>

            <select
              name="category"
              required
              className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
              data-testid="report-category"
            >
              <option value="">Select a category...</option>
              <option value="harassment">Harassment or bullying</option>
              <option value="hate_speech">Hate speech</option>
              <option value="spam">Spam or scam</option>
              <option value="csam">Child sexual abuse material (CSAM)</option>
              <option value="self_harm">Self-harm or suicide</option>
              <option value="violence">Violence or threats</option>
              <option value="nudity_unmarked">Unmarked adult content</option>
              <option value="impersonation">Impersonation</option>
              <option value="privacy">Privacy violation</option>
              <option value="other">Other</option>
            </select>

            <textarea
              name="description"
              required
              maxLength={2000}
              rows={4}
              placeholder="Describe what you are reporting..."
              className="mt-3 w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400"
              data-testid="report-description"
            />

            {state.message && !state.success && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400" data-testid="report-error">
                {state.message}
              </p>
            )}

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
                data-testid="report-submit-button"
              >
                {isPending ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
