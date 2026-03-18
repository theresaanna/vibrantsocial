"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import { timeAgo } from "@/lib/time";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/notifications/actions";
import type { NotificationType } from "@/generated/prisma/client";
import { getNotificationText } from "@/lib/notification-text";

interface NotificationActor {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatar: string | null;
  profileFrameId: string | null;
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
  post: { id: string; content: string } | null;
  message: { id: string; conversationId: string } | null;
  tag: { id: string; name: string } | null;
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

  const hasUnread = notifications.some((n) => !n.readAt);

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

  if (notifications.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-zinc-400">
        No notifications yet
      </div>
    );
  }

  return (
    <div>
      {hasUnread && (
        <div className="flex justify-end border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
          <button
            onClick={handleMarkAllRead}
            disabled={isPending}
            className="text-xs font-medium text-blue-500 hover:text-blue-600 disabled:opacity-50"
          >
            Mark all as read
          </button>
        </div>
      )}
      <div>
        {notifications.map((notification) => {
          const avatar =
            notification.actor.avatar ?? notification.actor.image;
          const name = getActorName(notification.actor);
          const text = getNotificationText(notification.type);
          const isUnread = !notification.readAt;
          const isCommentType =
            notification.type === "COMMENT" || notification.type === "REPLY";
          const isMentionWithComment =
            notification.type === "MENTION" && notification.commentId;
          let href: string;
          if ((isCommentType || isMentionWithComment) && notification.postId && notification.commentId) {
            href = `/post/${notification.postId}?commentId=${notification.commentId}`;
          } else if (notification.type === "REACTION" && notification.message) {
            href = `/chat/${notification.message.conversationId}`;
          } else if (notification.type === "FRIEND_REQUEST") {
            href = `/${notification.actor.username}`;
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
              }`}
            >
              {notification.actor.username ? (
                <Link
                  href={`/${notification.actor.username}`}
                  className="relative z-10 flex-shrink-0"
                >
                  {avatarImg}
                </Link>
              ) : (
                <span className="relative z-10 flex-shrink-0">
                  {avatarImg}
                </span>
              )}
              <Link
                href={href}
                onClick={() => {
                  if (isUnread) handleMarkRead(notification.id);
                }}
                className="static min-w-0 flex-1 after:absolute after:inset-0 after:content-['']"
              >
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {notification.type === "CONTENT_MODERATION" ? (
                    <span>{text}</span>
                  ) : (
                    <>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {name}
                      </span>{" "}
                      {text}
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {timeAgo(new Date(notification.createdAt))}
                </p>
              </Link>
              {isUnread && (
                <span className="relative z-10 mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
