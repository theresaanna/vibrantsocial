"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import type { InboundMessage } from "ably";
import { useAblyReady } from "@/app/providers";
import { getAblyRealtimeClient } from "@/lib/ably";
import { getUnreadNotificationCount } from "@/app/notifications/actions";
import { getConversations } from "@/app/chat/actions";

const TADA_FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎉</text></svg>";
const ALERT_FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2371717a'/><g transform='translate(14,12) scale(3)' stroke-linecap='round' stroke-linejoin='round'><path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' fill='%23c026d3' stroke='%23c026d3' stroke-width='2'/><path d='M13.73 21a2 2 0 0 1-3.46 0' fill='none' stroke='%23c026d3' stroke-width='2'/></g></svg>";

function setFavicon(hasUnread: boolean) {
  let link = document.querySelector(
    "link[rel='icon']"
  ) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = hasUnread ? ALERT_FAVICON : TADA_FAVICON;
}

async function fetchHasUnread(): Promise<boolean> {
  const [notifCount, convos] = await Promise.all([
    getUnreadNotificationCount(),
    getConversations(),
  ]);
  const chatUnread = convos.reduce(
    (sum: number, c: { unreadCount: number }) => sum + c.unreadCount,
    0
  );
  return notifCount > 0 || chatUnread > 0;
}

export function DynamicFavicon({
  initialHasUnread,
}: {
  initialHasUnread: boolean;
}) {
  const [hasUnread, setHasUnread] = useState(initialHasUnread);
  const { data: session } = useSession();
  const ablyReady = useAblyReady();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const prevPathnameRef = useRef(pathname);

  // Update favicon element when state changes
  useEffect(() => {
    setFavicon(hasUnread);
  }, [hasUnread]);

  // Re-check when leaving notifications or chat pages
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    const wasOnNotifs = prev === "/notifications";
    const wasOnChat = prev.startsWith("/chat/");

    if (wasOnNotifs || wasOnChat) {
      fetchHasUnread().then(setHasUnread);
    }
  }, [pathname]);

  // Re-check on window focus
  useEffect(() => {
    const onFocus = () => fetchHasUnread().then(setHasUnread);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Subscribe to Ably for instant favicon changes
  useEffect(() => {
    if (!ablyReady || !session?.user?.id) return;

    const client = getAblyRealtimeClient();
    const notifChannel = client.channels.get(
      `notifications:${session.user.id}`
    );
    const chatChannel = client.channels.get(
      `chat-notify:${session.user.id}`
    );

    const handleNotif = () => {
      if (pathnameRef.current === "/notifications") return;
      setHasUnread(true);
    };

    const handleChat = (msg: InboundMessage) => {
      if (msg.data?.senderId === session?.user?.id) return;
      const convId = msg.data?.conversationId;
      if (pathnameRef.current === `/chat/${convId}`) return;
      setHasUnread(true);
    };

    notifChannel.subscribe("new", handleNotif);
    chatChannel.subscribe("new", handleChat);

    return () => {
      notifChannel.unsubscribe("new", handleNotif);
      chatChannel.unsubscribe("new", handleChat);
    };
  }, [ablyReady, session?.user?.id]);

  return null;
}
