"use client";

import { useActionState } from "react";
import { acceptMessageRequest, declineMessageRequest } from "@/app/chat/actions";
import { useRouter } from "next/navigation";
import { FramedAvatar } from "@/components/framed-avatar";
import type { MessageRequestData, ActionState } from "@/types/chat";

interface MessageRequestCardProps {
  request: MessageRequestData;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function MessageRequestCard({
  request,
  selectMode,
  isSelected,
  onToggleSelect,
}: MessageRequestCardProps) {
  const router = useRouter();
  const sender = request.sender;
  const avatar = sender.avatar ?? sender.image;
  const displayName = sender.displayName ?? sender.username ?? sender.name ?? "User";

  const [acceptState, acceptAction, acceptPending] = useActionState(
    async (_prev: ActionState) => {
      const result = await acceptMessageRequest(request.id);
      if (result.success && result.conversationId) {
        router.push(`/chat/${result.conversationId}`);
      }
      return result;
    },
    { success: false, message: "" }
  );

  const [declineState, declineAction, declinePending] = useActionState(
    async (_prev: ActionState) => {
      return declineMessageRequest(request.id);
    },
    { success: false, message: "" }
  );

  if (declineState.success) return null;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 ${
        selectMode
          ? "cursor-pointer"
          : ""
      } ${
        isSelected
          ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
      onClick={selectMode ? () => onToggleSelect?.(request.id) : undefined}
    >
      {selectMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect?.(request.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 shrink-0 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
        />
      )}
      <FramedAvatar
        src={avatar}
        alt={displayName}
        initial={displayName[0]?.toUpperCase()}
        size={40}
        frameId={sender.profileFrameId}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {displayName}
        </p>
        {sender.username && (
          <p className="text-xs text-zinc-500">@{sender.username}</p>
        )}
        <p className="text-xs text-zinc-400">wants to message you</p>
      </div>
      {!selectMode && (
        <div className="flex gap-2">
          <form action={acceptAction}>
            <button
              type="submit"
              disabled={acceptPending || declinePending}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {acceptPending ? "..." : "Accept"}
            </button>
          </form>
          <form action={declineAction}>
            <button
              type="submit"
              disabled={acceptPending || declinePending}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {declinePending ? "..." : "Decline"}
            </button>
          </form>
        </div>
      )}
      {acceptState.message && !acceptState.success && (
        <p className="text-xs text-red-600">{acceptState.message}</p>
      )}
    </div>
  );
}
