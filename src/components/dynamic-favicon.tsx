"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import type { InboundMessage } from "ably";
import { useAblyReady } from "@/app/providers";
import { getAblyRealtimeClient } from "@/lib/ably";
import { getUnreadNotificationCount } from "@/app/notifications/actions";
import { getConversations } from "@/app/chat/actions";

const DEFAULT_FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='2 3 20 18'><path d='M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z' fill='%23c026d3' stroke='%23c026d3' stroke-width='0.5' stroke-linecap='round' stroke-linejoin='round'/></svg>";
const ALERT_FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='2 3 20 18'><path d='M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z' fill='%23c026d3' stroke='%23c026d3' stroke-width='0.5' stroke-linecap='round' stroke-linejoin='round'/><g transform='translate(13 11) scale(0.45)'><path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' fill='%233f3f46' stroke='%233f3f46' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/><path d='M13.73 21a2 2 0 0 1-3.46 0' fill='none' stroke='%233f3f46' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></g></svg>";

function setFavicon(hasUnread: boolean) {
  const href = hasUnread ? ALERT_FAVICON : DEFAULT_FAVICON;
  // Overwrite all existing icon links in place (don't remove — Next.js tracks them)
  const links = document.querySelectorAll("link[rel='icon']");
  if (links.length === 0) {
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = href;
    document.head.appendChild(link);
  } else {
    links.forEach((el) => {
      const link = el as HTMLLinkElement;
      link.type = "image/svg+xml";
      link.href = href;
    });
  }
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

  // Update favicon element when state changes or on navigation
  // (Next.js may re-insert its static icon during client-side routing)
  useEffect(() => {
    setFavicon(hasUnread);
  }, [hasUnread, pathname]);

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
