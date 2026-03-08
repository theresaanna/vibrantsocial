"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/time";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/notifications/actions";
import type { NotificationType } from "@/generated/prisma/client";

interface NotificationActor {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatar: string | null;
}

interface NotificationItem {
  id: string;
  type: NotificationType;
  actorId: string;
  postId: string | null;
  commentId: string | null;
  messageId: string | null;
  readAt: Date | null;
  createdAt: Date;
  actor: NotificationActor;
  post: { id: string; content: string } | null;
  message: { id: string; conversationId: string } | null;
}

function getNotificationText(type: NotificationType): string {
  switch (type) {
    case "LIKE":
      return "liked your post";
    case "COMMENT":
      return "commented on your post";
    case "REPLY":
      return "replied to your comment";
    case "REPOST":
      return "reposted your post";
    case "BOOKMARK":
      return "bookmarked your post";
    case "FOLLOW":
      return "followed you";
    case "REACTION":
      return "reacted to your message";
    case "MENTION":
      return "mentioned you";
    case "FRIEND_REQUEST":
      return "sent you a friend request";
  }
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
          } else if (notification.postId) {
            href = `/post/${notification.postId}`;
          } else {
            href = "/notifications";
          }

          return (
            <Link
              key={notification.id}
              href={href}
              onClick={() => {
                if (isUnread) handleMarkRead(notification.id);
              }}
              className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                isUnread
                  ? "bg-blue-50/50 dark:bg-blue-950/20"
                  : ""
              }`}
            >
              <div className="flex-shrink-0">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {name[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {name}
                  </span>{" "}
                  {text}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {timeAgo(new Date(notification.createdAt))}
                </p>
              </div>
              {isUnread && (
                <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
