"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { timeAgo } from "@/lib/time";
import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotifications,
} from "@/app/notifications/actions";
import type { NotificationType } from "@/generated/prisma/client";
import { getNotificationText } from "@/lib/notification-text";
import { StyledName } from "@/components/styled-name";
import { FriendRequestNotificationActions } from "@/components/friend-request-notification-actions";
import { ChatRequestNotificationActions } from "@/components/chat-request-notification-actions";
import { WallPostNotificationActions } from "@/components/wall-post-notification-actions";
import { ChatAbuseNotificationActions } from "@/components/chat-abuse-notification-actions";
import { useSelectionSet } from "@/hooks/use-selection-set";

interface NotificationActor {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatar: string | null;
  profileFrameId: string | null;
  usernameFont?: string | null;
}

interface NotificationItem {
  id: string;
  type: NotificationType;
  actorId: string;
  postId: string | null;
  commentId: string | null;
  messageId: string | null;
  repostId: string | null;
  readAt: Date | null;
  createdAt: Date;
  actor: NotificationActor;
  post: { id: string; content: string; wallPost?: { id: string; status: string } | null } | null;
  message: { id: string; conversationId: string } | null;
  tag: { id: string; name: string } | null;
  userList: { id: string; name: string } | null;
  hasPendingFriendRequest?: boolean;
  hasPendingChatRequest?: boolean;
}

function getActorName(actor: NotificationActor): string {
  return actor.displayName ?? actor.username ?? actor.name ?? "Someone";
}

export function NotificationList({
  initialNotifications,
}: {
  initialNotifications: NotificationItem[];
}) {
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(initialNotifications);
  const [isPending, startTransition] = useTransition();
  const selection = useSelectionSet();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasUnread = notifications.some((n) => !n.readAt);
  const allSelected = notifications.length > 0 && selection.selectedIds.size === notifications.length;

  function handleMarkRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n))
    );
    startTransition(async () => {
      await markNotificationRead(id);
    });
  }

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date() })));
    startTransition(async () => {
      await markAllNotificationsRead();
    });
  }

  function handleDeleteSelected() {
    const ids = Array.from(selection.selectedIds);
    setNotifications((prev) => prev.filter((n) => !selection.selectedIds.has(n.id)));
    setShowDeleteConfirm(false);
    selection.exit();
    startTransition(async () => {
      await deleteNotifications(ids);
    });
  }

  if (notifications.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-zinc-400">
        No notifications yet
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
        {selection.active ? (
          <>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => selection.selectAll(notifications.map(n => n.id))}
                  className="rounded"
                />
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  Select all
                </span>
              </label>
              {selection.selectedIds.size > 0 && (
                <span className="text-xs text-zinc-500">
                  {selection.selectedIds.size} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selection.selectedIds.size > 0 && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending}
                  className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
              <button
                onClick={selection.exit}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={selection.enter}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300"
            >
              Select
            </button>
            {hasUnread && (
              <button
                onClick={handleMarkAllRead}
                disabled={isPending}
                className="text-xs font-medium text-blue-500 hover:text-blue-600 disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
          </>
        )}
      </div>

      {/* Notification rows */}
      <div>
        {notifications.map((notification) => {
          const avatar =
            notification.actor.avatar ?? notification.actor.image;
          const name = getActorName(notification.actor);
          const text = getNotificationText(notification.type);
          const isUnread = !notification.readAt;
          const isSelected = selection.selectedIds.has(notification.id);
          const isCommentType =
            notification.type === "COMMENT" || notification.type === "REPLY";
          const isMentionWithComment =
            notification.type === "MENTION" && notification.commentId;
          let href: string;
          if ((isCommentType || isMentionWithComment) && notification.postId && notification.commentId) {
            href = `/post/${notification.postId}?commentId=${notification.commentId}`;
          } else if (notification.type === "CHAT_ABUSE" && notification.message) {
            href = `/chat/${notification.message.conversationId}`;
          } else if (notification.type === "REACTION" && notification.message) {
            href = `/chat/${notification.message.conversationId}`;
          } else if (notification.type === "FRIEND_REQUEST" || notification.type === "FRIEND_REQUEST_ACCEPTED" || notification.type === "CHAT_REQUEST") {
            href = `/${notification.actor.username}`;
          } else if (
            (notification.type === "LIST_ADD" || notification.type === "LIST_COLLABORATOR_ADD") &&
            notification.userList
          ) {
            href = `/lists/${notification.userList.id}`;
          } else if (notification.type === "CHAT_REQUEST_ACCEPTED") {
            href = `/chat`;
          } else if (notification.type === "MENTION" && notification.repostId) {
            href = `/quote/${notification.repostId}`;
          } else if (notification.postId) {
            href = `/post/${notification.postId}`;
          } else if (notification.repostId) {
            href = `/quote/${notification.repostId}`;
          } else {
            href = "/notifications";
          }

          const avatarImg = (
            <FramedAvatar src={avatar} alt={name} initial={name[0]?.toUpperCase()} size={50} frameId={notification.actor.profileFrameId} />
          );

          return (
            <div
              key={notification.id}
              className={`relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                isUnread
                  ? "bg-blue-50/50 dark:bg-blue-950/20"
                  : ""
              } ${isSelected ? "bg-fuchsia-50/50 dark:bg-fuchsia-950/20" : ""}`}
            >
              {selection.active && (
                <label className="relative z-10 mt-2 flex-shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => selection.toggle(notification.id)}
                    className="rounded"
                  />
                </label>
              )}
              {notification.actor.username ? (
                <Link
                  href={`/${notification.actor.username}`}
                  className="relative z-10 flex-shrink-0"
                  tabIndex={selection.active ? -1 : undefined}
                >
                  {avatarImg}
                </Link>
              ) : (
                <span className="relative z-10 flex-shrink-0">
                  {avatarImg}
                </span>
              )}
              <div className="min-w-0 flex-1">
                {selection.active ? (
                  <div
                    className="cursor-pointer"
                    onClick={() => selection.toggle(notification.id)}
                  >
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {notification.type === "CONTENT_MODERATION" ? (
                        <span>{text}</span>
                      ) : (
                        <>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            <StyledName fontId={notification.actor.usernameFont}>{name}</StyledName>
                          </span>{" "}
                          {text}
                        </>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {timeAgo(new Date(notification.createdAt))}
                    </p>
                  </div>
                ) : (
                  <>
                    <Link
                      href={href}
                      onClick={() => {
                        if (isUnread) handleMarkRead(notification.id);
                      }}
                      className="static after:absolute after:inset-0 after:content-['']"
                    >
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        {notification.type === "CONTENT_MODERATION" ? (
                          <span>{text}</span>
                        ) : (
                          <>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              <StyledName fontId={notification.actor.usernameFont}>{name}</StyledName>
                            </span>{" "}
                            {text}
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {timeAgo(new Date(notification.createdAt))}
                      </p>
                    </Link>
                    {notification.type === "FRIEND_REQUEST" &&
                      notification.hasPendingFriendRequest && (
                        <FriendRequestNotificationActions
                          actorId={notification.actorId}
                        />
                      )}
                    {notification.type === "CHAT_REQUEST" &&
                      notification.hasPendingChatRequest && (
                        <ChatRequestNotificationActions
                          actorId={notification.actorId}
                        />
                      )}
                    {notification.type === "WALL_POST" &&
                      notification.post?.wallPost &&
                      notification.post.wallPost.status === "pending" && (
                        <WallPostNotificationActions
                          wallPostId={notification.post.wallPost.id}
                        />
                      )}
                    {notification.type === "CHAT_ABUSE" && (
                      <ChatAbuseNotificationActions
                        actorId={notification.actorId}
                        conversationId={notification.message?.conversationId ?? null}
                      />
                    )}
                  </>
                )}
              </div>
              {!selection.active && isUnread && (
                <span className="relative z-10 mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
              )}
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete notifications"
        message={`Are you sure you want to delete ${selection.selectedIds.size} notification${selection.selectedIds.size === 1 ? "" : "s"}? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteSelected}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
