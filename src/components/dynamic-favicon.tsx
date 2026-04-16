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
  initialNotifCount,
  initialChatCount,
}: {
  initialNotifCount: number;
  initialChatCount: number;
}) {
  const [notifCount, setNotifCount] = useState(initialNotifCount);
  const [chatCount, setChatCount] = useState(initialChatCount);
  const { data: session } = useSession();
  const ablyReady = useAblyReady();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const prevPathnameRef = useRef(pathname);

  const totalCount = notifCount + chatCount;

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

  // Update page title when total count changes, and re-apply if
  // Next.js overwrites the title (e.g. during client-side navigation
  // or metadata refresh).
  const totalCountRef = useRef(totalCount);
  totalCountRef.current = totalCount;

  useEffect(() => {
    updateTitle(totalCount);

    // Watch for Next.js overwriting the <title> and re-apply the prefix
    const titleEl = document.querySelector("title");
    if (!titleEl) return;

    const observer = new MutationObserver(() => {
      const current = document.title;
      const count = totalCountRef.current;
      if (count > 0 && !current.startsWith(`(${count})`)) {
        updateTitle(count);
      }
    });

    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [totalCount, pathname]);

  // Reset the appropriate counter when visiting notifications or chat
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    if (pathname === "/notifications") {
      setNotifCount(0);
    } else if (pathname.startsWith("/messages/") || pathname === "/messages") {
      setChatCount(0);
    }
    // When leaving these pages, counts rebuild from Ably events
    void prev; // suppress unused lint
  }, [pathname]);

  // Subscribe to Ably for instant updates
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
      setNotifCount((prev) => prev + 1);
    };

    const handleChat = (msg: InboundMessage) => {
      if (msg.data?.senderId === session?.user?.id) return;
      const convId = msg.data?.conversationId;
      if (pathnameRef.current === `/messages/${convId}`) return;
      setChatCount((prev) => prev + 1);
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
