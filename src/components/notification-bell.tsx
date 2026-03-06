"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useAblyReady } from "@/app/providers";
import { getAblyRealtimeClient } from "@/lib/ably";

export function NotificationBell({
  initialUnreadCount,
}: {
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const { data: session } = useSession();
  const ablyReady = useAblyReady();

  const handleNewNotification = useCallback(() => {
    setUnreadCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!ablyReady || !session?.user?.id) return;

    const client = getAblyRealtimeClient();
    const channel = client.channels.get(`notifications:${session.user.id}`);
    channel.subscribe({ name: "new" }, handleNewNotification);

    return () => {
      channel.unsubscribe({ name: "new" }, handleNewNotification);
    };
  }, [ablyReady, session?.user?.id, handleNewNotification]);

  return (
    <Link
      href="/notifications"
      className="relative text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
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
    </Link>
  );
}
