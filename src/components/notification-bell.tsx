"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import type { InboundMessage } from "ably";
import { useAblyReady } from "@/app/providers";
import { getAblyRealtimeClient } from "@/lib/ably";
import {
  getRecentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/notifications/actions";
import { rpc } from "@/lib/rpc";
import { timeAgo } from "@/lib/time";
import { Tooltip } from "@/components/tooltip";
import type { NotificationType } from "@/generated/prisma/client";
import { getNotificationText } from "@/lib/notification-text";
import { FriendRequestNotificationActions } from "@/components/friend-request-notification-actions";
import { StyledName } from "@/components/styled-name";

interface NotificationActor {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatar: string | null;
  profileFrameId: string | null;
  usernameFont: string | null;
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
  hasPendingFriendRequest?: boolean;
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
    return `/messages/${notification.message.conversationId}`;
  }
  if (notification.type === "FRIEND_REQUEST") {
    return `/${notification.actor.username}`;
  }
  if (notification.type === "MENTION" && notification.repostId) {
    return `/quote/${notification.repostId}`;
  }
  if (notification.postId) {
    return `/post/${notification.postId}`;
  }
  if (notification.repostId) {
    return `/quote/${notification.repostId}`;
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

  // Clear badge on notifications page, re-fetch actual count when leaving.
  // Uses fetch() instead of the server action so the response doesn't carry
  // RSC flight data that could flash a stale page during navigation.
  useEffect(() => {
    if (pathname === "/notifications") {
      setUnreadCount(0);
      wasOnNotificationsRef.current = true;
    } else if (wasOnNotificationsRef.current) {
      wasOnNotificationsRef.current = false;
      rpc<number>("getUnreadNotificationCount")
        .then(setUnreadCount)
        .catch(() => {});
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
    <div className="relative inline-flex" ref={containerRef}>
      <Tooltip label="Notifications">
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
        <span
          className={`absolute -right-1.5 -top-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium transition-opacity ${
            unreadCount > 0
              ? "bg-blue-500 text-white opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          aria-hidden={unreadCount === 0}
        >
          {unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : "0"}
        </span>
      </button>
      </Tooltip>

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

              const avatarImg = (
                <FramedAvatar src={avatar} alt={name} initial={name[0]?.toUpperCase()} size={40} frameId={notification.actor.profileFrameId} />
              );

              return (
                <div
                  key={notification.id}
                  className={`relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                    isUnread ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                  }`}
                >
                  {notification.actor.username ? (
                    <Link
                      href={`/${notification.actor.username}`}
                      className="relative z-10 flex-shrink-0"
                      onClick={() => setIsOpen(false)}
                    >
                      {avatarImg}
                    </Link>
                  ) : (
                    <span className="relative z-10 flex-shrink-0">
                      {avatarImg}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={href}
                      onClick={() => {
                        if (isUnread) handleMarkRead(notification.id);
                        setIsOpen(false);
                      }}
                      className="static after:absolute after:inset-0 after:content-['']"
                    >
                      <p className="text-xs text-zinc-700 dark:text-zinc-300">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          <StyledName fontId={notification.actor.usernameFont}>{name}</StyledName>
                        </span>{" "}
                        {text}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-400">
                        {timeAgo(new Date(notification.createdAt))}
                      </p>
                    </Link>
                    {notification.type === "FRIEND_REQUEST" &&
                      notification.hasPendingFriendRequest && (
                        <FriendRequestNotificationActions
                          actorId={notification.actorId}
                          onRespond={() => {
                            getRecentNotifications().then(setNotifications);
                          }}
                        />
                      )}
                  </div>
                  {isUnread && (
                    <span className="relative z-10 mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  )}
                </div>
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
