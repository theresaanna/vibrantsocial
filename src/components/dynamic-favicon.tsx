"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import type { InboundMessage } from "ably";
import { useAblyReady } from "@/app/providers";
import { getAblyRealtimeClient } from "@/lib/ably";

/** Strip any existing "(N) " prefix from the title */
function baseTitle(title: string): string {
  return title.replace(/^\(\d+\)\s*/, "");
}

function updateTitle(count: number) {
  const base = baseTitle(document.title);
  document.title = count > 0 ? `(${count}) ${base}` : base;
}

export function DynamicFavicon({
  initialHasUnread,
}: {
  initialHasUnread: boolean;
}) {
  const [unreadCount, setUnreadCount] = useState(initialHasUnread ? 1 : 0);
  const { data: session } = useSession();
  const ablyReady = useAblyReady();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const prevPathnameRef = useRef(pathname);

  // Set the favicon to the static PNG on mount
  useEffect(() => {
    const links = document.querySelectorAll("link[rel='icon']");
    const href = "/icon-32.png";
    if (links.length === 0) {
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      link.href = href;
      document.head.appendChild(link);
    } else {
      links.forEach((el) => {
        const link = el as HTMLLinkElement;
        link.type = "image/png";
        link.href = href;
      });
    }
  }, [pathname]);

  // Update page title when unread count changes
  useEffect(() => {
    updateTitle(unreadCount);
  }, [unreadCount, pathname]);

  // Reset count when visiting notifications or chat pages
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    if (pathname === "/notifications" || pathname.startsWith("/chat/")) {
      setUnreadCount(0);
    } else if (prev === "/notifications" || prev.startsWith("/chat/")) {
      // Count will rebuild from Ably events
    }
  }, [pathname]);

  // Subscribe to Ably for instant updates (single subscription point)
  useEffect(() => {
    if (!ablyReady || !session?.user?.id) return;

    const client = getAblyRealtimeClient();
    const notifChannel = client.channels.get(
      `notifications:${session.user.id}`,
    );
    const chatChannel = client.channels.get(
      `chat-notify:${session.user.id}`,
    );

    const handleNotif = () => {
      if (pathnameRef.current === "/notifications") return;
      setUnreadCount((prev) => prev + 1);
    };

    const handleChat = (msg: InboundMessage) => {
      if (msg.data?.senderId === session?.user?.id) return;
      const convId = msg.data?.conversationId;
      if (pathnameRef.current === `/chat/${convId}`) return;
      setUnreadCount((prev) => prev + 1);
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
