"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { toggleBlock } from "@/app/feed/block-actions";
import { dismissChatAbuseAlerts } from "@/app/chat/actions";
import { ReportModal } from "@/components/report-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface ChatAbuseNotificationActionsProps {
  actorId: string;
  conversationId: string | null;
}

export function ChatAbuseNotificationActions({
  actorId,
  conversationId,
}: ChatAbuseNotificationActionsProps) {
  const [showReport, setShowReport] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [, blockAction] = useActionState(toggleBlock, { success: false, message: "" });

  if (dismissed && !blocked) {
    return (
      <p className="mt-1 text-xs text-zinc-400">
        Future alerts from this user dismissed.
      </p>
    );
  }

  if (blocked) {
    return (
      <p className="mt-1 text-xs text-zinc-400">
        User blocked.
      </p>
    );
  }

  return (
    <div className="relative z-10 mt-2 flex flex-wrap gap-2">
      <button
        onClick={() => setShowReport(true)}
        className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
      >
        Report
      </button>
      <button
        onClick={() => setShowBlockConfirm(true)}
        disabled={isPending}
        className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        Block
      </button>
      <button
        onClick={() => {
          startTransition(async () => {
            await dismissChatAbuseAlerts(actorId);
            setDismissed(true);
          });
        }}
        disabled={isPending}
        className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        Dismiss
      </button>

      {showReport && conversationId && (
        <ReportModal
          contentType="conversation"
          contentId={conversationId}
          isOpen={showReport}
          onClose={() => setShowReport(false)}
        />
      )}

      <ConfirmDialog
        open={showBlockConfirm}
        title="Block user"
        message="They won't be able to message you or see your posts. They won't be notified."
        confirmLabel="Block"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setShowBlockConfirm(false);
          const formData = new FormData();
          formData.set("targetUserId", actorId);
          formData.set("action", "block");
          startTransition(async () => {
            await blockAction(formData);
            setBlocked(true);
          });
        }}
        onCancel={() => setShowBlockConfirm(false)}
      />
    </div>
  );
}
