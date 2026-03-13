"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { InboundMessage } from "ably";
import { useAblyReady } from "@/app/providers";
import { getAblyRealtimeClient } from "@/lib/ably";
import {
  getUnreadNotificationCount,
  getRecentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/notifications/actions";
import { timeAgo } from "@/lib/time";
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
  tag: { id: string; name: string } | null;
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
    case "NEW_POST":
      return "published a new post";
    case "TAG_POST":
      return "posted in a tag you follow";
  }
}

function getNotificationHref(notification: NotificationItem): string {
  const isCommentType =
    notification.type === "COMMENT" || notification.type === "REPLY";
  const isMentionWithComment =
    notification.type === "MENTION" && notification.commentId;

  if (
    (isCommentType || isMentionWithComment) &&
    notification.postId &&
    notification.commentId
  ) {
    return `/post/${notification.postId}?commentId=${notification.commentId}`;
  }
  if (notification.type === "REACTION" && notification.message) {
    return `/chat/${notification.message.conversationId}`;
  }
  if (notification.type === "FRIEND_REQUEST") {
    return `/${notification.actor.username}`;
  }
  if (notification.postId) {
    return `/post/${notification.postId}`;
  }
  return "/notifications";
}

export function NotificationBell({
  initialUnreadCount,
  initialNotifications,
}: {
  initialUnreadCount: number;
  initialNotifications: NotificationItem[];
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(initialNotifications);
  const { data: session } = useSession();
  const ablyReady = useAblyReady();
  const pathname = usePathname();
  const router = useRouter();
  const wasOnNotificationsRef = useRef(false);
  const pathnameRef = useRef(pathname);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const handleNewNotification = useCallback((_msg: InboundMessage) => {
    // Don't increment badge while user is viewing notifications
    if (pathnameRef.current === "/notifications") return;
    setUnreadCount((prev) => prev + 1);
  }, []);

  // Clear badge on notifications page, re-fetch actual count when leaving
  useEffect(() => {
    if (pathname === "/notifications") {
      setUnreadCount(0);
      wasOnNotificationsRef.current = true;
    } else if (wasOnNotificationsRef.current) {
      wasOnNotificationsRef.current = false;
      getUnreadNotificationCount().then(setUnreadCount);
    }
  }, [pathname]);

  useEffect(() => {
    if (!ablyReady || !session?.user?.id) return;

    const client = getAblyRealtimeClient();
    const channel = client.channels.get(`notifications:${session.user.id}`);
    channel.subscribe("new", handleNewNotification);

    return () => {
      channel.unsubscribe("new", handleNewNotification);
    };
  }, [ablyReady, session?.user?.id, handleNewNotification]);

  // Close pane on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Refresh notifications when pane opens
  useEffect(() => {
    if (isOpen) {
      getRecentNotifications().then(setNotifications);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  function handleMarkRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    markNotificationRead(id);
  }

  function handleMarkAllRead() {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: new Date() }))
    );
    setUnreadCount(0);
    markAllNotificationsRead();
  }

  const isNotificationsActive = pathname === "/notifications";
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative rounded-lg p-1.5 transition-colors ${
          isNotificationsActive
            ? "bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-500"
            : "text-zinc-600 hover:bg-blue-50 hover:text-blue-500 dark:text-zinc-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-500"
        }`}
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-3 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown pane */}
      <div
        className={`absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 ${
          isOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Notifications
          </h3>
          {hasUnread && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-medium text-blue-500 hover:text-blue-600"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => {
              const avatar =
                notification.actor.avatar ?? notification.actor.image;
              const name =
                notification.actor.displayName ??
                notification.actor.username ??
                notification.actor.name ??
                "Someone";
              const text = getNotificationText(notification.type);
              const isUnread = !notification.readAt;
              const href = getNotificationHref(notification);

              return (
                <Link
                  key={notification.id}
                  href={href}
                  onClick={() => {
                    if (isUnread) handleMarkRead(notification.id);
                    setIsOpen(false);
                  }}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                    isUnread ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                  }`}
                >
                  <span
                    className={`flex-shrink-0${notification.actor.username ? " cursor-pointer" : ""}`}
                    onClick={(e) => {
                      if (notification.actor.username) {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsOpen(false);
                        router.push(`/${notification.actor.username}`);
                      }
                    }}
                  >
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                        {name[0]?.toUpperCase()}
                      </div>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-700 dark:text-zinc-300">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {name}
                      </span>{" "}
                      {text}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-400">
                      {timeAgo(new Date(notification.createdAt))}
                    </p>
                  </div>
                  {isUnread && (
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  )}
                </Link>
              );
            })
          )}
        </div>

        <Link
          href="/notifications"
          onClick={() => setIsOpen(false)}
          className="block border-t border-zinc-100 px-4 py-2.5 text-center text-xs font-medium text-blue-500 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}
