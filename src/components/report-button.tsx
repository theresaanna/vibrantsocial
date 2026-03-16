"use client";

import { useState } from "react";
import { ReportModal } from "@/components/report-modal";

interface ReportButtonProps {
  contentType: "post" | "comment" | "profile";
  contentId: string;
  label?: string;
}

export function ReportButton({ contentType, contentId, label = "Report" }: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        data-testid="profile-report-button"
      >
        {label}
      </button>
      <ReportModal
        contentType={contentType}
        contentId={contentId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
