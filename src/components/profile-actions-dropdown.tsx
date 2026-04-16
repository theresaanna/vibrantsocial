"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import { toggleFollow } from "@/app/feed/follow-actions";
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  type FriendshipStatus,
} from "@/app/feed/friend-actions";
import { togglePostSubscription } from "@/app/feed/subscription-actions";
import { addCloseFriend, removeCloseFriend } from "@/app/feed/close-friends-actions";
import { startConversation } from "@/app/chat/actions";
import { sendChatRequest, cancelChatRequest, type ChatRequestStatus } from "@/app/chat/actions";
import { toggleBlock } from "@/app/feed/block-actions";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReportModal } from "@/components/report-modal";

interface ProfileActionsDropdownProps {
  userId: string;
  isFollowing: boolean;
  friendshipStatus: FriendshipStatus;
  friendRequestId?: string;
  isSubscribed: boolean;
  isFriend: boolean;
  isCloseFriend: boolean;
  chatRequestStatus: ChatRequestStatus;
  isBlocked?: boolean;
  hasVerifiedPhone?: boolean;
}

const initialState = { success: false, message: "" };

export function ProfileActionsDropdown({
  userId,
  isFollowing,
  friendshipStatus,
  friendRequestId,
  isSubscribed,
  isFriend,
  isCloseFriend,
  chatRequestStatus: initialChatStatus,
  isBlocked = false,
  hasVerifiedPhone = false,
}: ProfileActionsDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockByPhone, setBlockByPhone] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [chatStatus, setChatStatus] = useState<ChatRequestStatus>(initialChatStatus);
  const [chatPending, setChatPending] = useState(false);
  const [messagePending, setMessagePending] = useState(false);

  const [, followAction, followPending] = useActionState(toggleFollow, initialState);
  const [sendState, sendFriendAction, sendFriendPending] = useActionState(sendFriendRequest, initialState);
  const [, acceptFriendAction, acceptFriendPending] = useActionState(acceptFriendRequest, initialState);
  const [, declineFriendAction, declineFriendPending] = useActionState(declineFriendRequest, initialState);
  const [removeState, removeFriendAction, removeFriendPending] = useActionState(removeFriend, initialState);
  const [, subscribeAction, subscribePending] = useActionState(togglePostSubscription, initialState);
  const [addCloseState, addCloseAction, addClosePending] = useActionState(addCloseFriend, initialState);
  const [removeCloseState, removeCloseAction, removeClosePending] = useActionState(removeCloseFriend, initialState);
  const [, blockAction, blockPending] = useActionState(toggleBlock, initialState);

  const closePending = addClosePending || removeClosePending;
  const isClose = addCloseState.success ? true : removeCloseState.success ? false : isCloseFriend;

  const effectiveFriendStatus = sendState.success ? "pending_sent" : removeState.success ? "none" : friendshipStatus;
  const effectiveIsFriend = effectiveFriendStatus === "friends";

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMessage = async () => {
    setMessagePending(true);
    setOpen(false);
    try {
      const result = await startConversation(userId);
      if (result.success && result.conversationId) {
        router.push(`/chat/${result.conversationId}`);
      }
    } finally {
      setMessagePending(false);
    }
  };

  const handleChatRequest = async () => {
    setChatPending(true);
    try {
      if (chatStatus === "pending") {
        const result = await cancelChatRequest(userId);
        if (result.success) setChatStatus("none");
      } else {
        const result = await sendChatRequest(userId);
        if (result.success) setChatStatus("pending");
      }
    } finally {
      setChatPending(false);
    }
    setOpen(false);
  };

  const handleFollowClick = () => {
    if (isFollowing) {
      setShowUnfollowConfirm(true);
      setOpen(false);
    }
  };

  const handleConfirmUnfollow = () => {
    setShowUnfollowConfirm(false);
    const form = document.getElementById(`dropdown-follow-form-${userId}`) as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  const handleUnfriendClick = () => {
    setShowUnfriendConfirm(true);
    setOpen(false);
  };

  const handleConfirmUnfriend = () => {
    setShowUnfriendConfirm(false);
    const form = document.getElementById(`dropdown-unfriend-form-${userId}`) as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  const handleBlockClick = () => {
    setBlockByPhone(false);
    setShowBlockConfirm(true);
    setOpen(false);
  };

  const handleConfirmBlock = () => {
    setShowBlockConfirm(false);
    const form = document.getElementById(`dropdown-block-form-${userId}`) as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  const handleReportClick = () => {
    setShowReportModal(true);
    setOpen(false);
  };

  const itemClass = "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50";

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          color: "var(--profile-text, #18181b)",
          backgroundColor: "color-mix(in srgb, var(--profile-secondary, #71717a) 15%, transparent)",
        }}
        className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all"
      >
        Actions
        <svg className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {/* Message / Chat Request */}
          {effectiveIsFriend ? (
            <button
              type="button"
              onClick={handleMessage}
              disabled={messagePending}
              className={itemClass}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
              {messagePending ? "Opening..." : "Message"}
            </button>
          ) : chatStatus !== "friends" && chatStatus !== "has_conversation" && chatStatus !== "accepted" ? (
            <button
              type="button"
              onClick={handleChatRequest}
              disabled={chatPending}
              className={itemClass}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
              {chatPending
                ? chatStatus === "pending" ? "Cancelling..." : "Sending..."
                : chatStatus === "pending" ? "Cancel Chat Request" : "Send Chat Request"}
            </button>
          ) : null}

          {/* Subscribe */}
          <form action={subscribeAction}>
            <input type="hidden" name="userId" value={userId} />
            <button type="submit" disabled={subscribePending} className={itemClass}>
              <svg className="h-4 w-4" fill={isSubscribed ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              {subscribePending ? "..." : isSubscribed ? "Unsubscribe" : "Subscribe to Posts"}
            </button>
          </form>

          <div className="border-t border-zinc-100 dark:border-zinc-700" />

          {/* Follow / Unfollow */}
          <form id={`dropdown-follow-form-${userId}`} action={followAction}>
            <input type="hidden" name="userId" value={userId} />
            {isFollowing ? (
              <button type="button" onClick={handleFollowClick} disabled={followPending} className={itemClass}>
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5Zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
                </svg>
                {followPending ? "..." : "Unfollow"}
              </button>
            ) : (
              <button type="submit" disabled={followPending} className={itemClass}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                {followPending ? "..." : "Follow"}
              </button>
            )}
          </form>

          {/* Friend actions */}
          {effectiveFriendStatus === "none" && (
            <form action={sendFriendAction}>
              <input type="hidden" name="userId" value={userId} />
              <button type="submit" disabled={sendFriendPending} className={itemClass}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
                {sendFriendPending ? "..." : "Add Friend"}
              </button>
            </form>
          )}
          {effectiveFriendStatus === "pending_sent" && (
            <span className={`${itemClass} opacity-60`}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Friend Request Pending
            </span>
          )}
          {effectiveFriendStatus === "pending_received" && (
            <>
              <form action={acceptFriendAction}>
                <input type="hidden" name="requestId" value={friendRequestId} />
                <button type="submit" disabled={acceptFriendPending} className={itemClass}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  {acceptFriendPending ? "..." : "Accept Friend Request"}
                </button>
              </form>
              <form action={declineFriendAction}>
                <input type="hidden" name="requestId" value={friendRequestId} />
                <button type="submit" disabled={declineFriendPending} className={itemClass}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                  {declineFriendPending ? "..." : "Decline Friend Request"}
                </button>
              </form>
            </>
          )}
          {effectiveFriendStatus === "friends" && (
            <>
              <form id={`dropdown-unfriend-form-${userId}`} action={removeFriendAction}>
                <input type="hidden" name="userId" value={userId} />
                <button type="button" onClick={handleUnfriendClick} disabled={removeFriendPending} className={itemClass}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                  </svg>
                  {removeFriendPending ? "..." : "Unfriend"}
                </button>
              </form>

              {/* Close friends toggle — only visible when friends */}
              <form action={isClose ? removeCloseAction : addCloseAction}>
                <input type="hidden" name="friendId" value={userId} />
                <button type="submit" disabled={closePending} className={itemClass}>
                  <svg className="h-4 w-4" fill={isClose ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                  </svg>
                  {closePending ? "..." : isClose ? "Remove Close Friend" : "Add Close Friend"}
                </button>
              </form>
            </>
          )}

          <div className="border-t border-zinc-100 dark:border-zinc-700" />

          {/* Report */}
          <button type="button" onClick={handleReportClick} className={itemClass}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
            Report
          </button>

          {/* Block / Unblock */}
          <form id={`dropdown-block-form-${userId}`} action={blockAction} className="hidden">
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="blockByPhone" value={blockByPhone ? "true" : "false"} />
          </form>
          <button
            type="button"
            onClick={handleBlockClick}
            disabled={blockPending}
            className={`${itemClass} ${isBlocked ? "text-red-600 dark:text-red-400" : ""}`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            {blockPending ? "..." : isBlocked ? "Unblock" : "Block"}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={showUnfollowConfirm}
        title="Unfollow?"
        message="Are you sure you want to unfollow this user? You will no longer see their posts in your feed."
        confirmLabel="Unfollow"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmUnfollow}
        onCancel={() => setShowUnfollowConfirm(false)}
      />

      <ConfirmDialog
        open={showUnfriendConfirm}
        title="Unfriend?"
        message="Are you sure you want to remove this friend? You will need to send a new friend request to reconnect."
        confirmLabel="Unfriend"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmUnfriend}
        onCancel={() => setShowUnfriendConfirm(false)}
      />

      <ConfirmDialog
        open={showBlockConfirm}
        title={isBlocked ? "Unblock this user?" : "Block this user?"}
        message={isBlocked
          ? "Are you sure you want to unblock this user? They will be able to see your profile and interact with your posts."
          : "Are you sure you want to block this user? They won't be able to see your profile or interact with your posts."}
        confirmLabel={isBlocked ? "Unblock" : "Block"}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmBlock}
        onCancel={() => setShowBlockConfirm(false)}
      >
        {hasVerifiedPhone && !isBlocked && (
          <label className="mt-3 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={blockByPhone}
              onChange={(e) => setBlockByPhone(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-600"
            />
            Also block by phone number
          </label>
        )}
      </ConfirmDialog>

      <ReportModal
        contentType="profile"
        contentId={userId}
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />
    </div>
  );
}
