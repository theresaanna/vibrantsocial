"use client";

import { useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Toaster, toast } from "sonner";
import { useAblyReady } from "@/app/providers";
import { getAblyRealtimeClient } from "@/lib/ably";
import type { NotificationType } from "@/generated/prisma";

function getToastText(type: NotificationType): string {
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
  }
}

function NotificationToastListener() {
  const { data: session } = useSession();
  const ablyReady = useAblyReady();
  const pathname = usePathname();

  const handleNotification = useCallback(
    (message: { data: { type: NotificationType; actor: string } }) => {
      // Don't toast if on notifications page
      if (pathname === "/notifications") return;

      const actor = JSON.parse(message.data.actor);
      const name =
        actor.displayName ?? actor.username ?? actor.name ?? "Someone";
      const text = getToastText(message.data.type);
      toast(`${name} ${text}`);
    },
    [pathname]
  );

  const handleChatMessage = useCallback(
    (message: {
      data: {
        senderId: string;
        sender: string;
        content: string;
        conversationId?: string;
      };
      name: string;
    }) => {
      if (message.data.senderId === session?.user?.id) return;

      // Extract conversationId from channel name (chat:{id})
      const channelConvId = message.name;
      if (pathname === `/chat/${channelConvId}`) return;

      const sender = JSON.parse(message.data.sender);
      const name =
        sender.displayName ?? sender.username ?? sender.name ?? "Someone";
      const preview =
        message.data.content.length > 50
          ? message.data.content.slice(0, 50) + "..."
          : message.data.content;
      toast(`${name}: ${preview}`);
    },
    [pathname, session?.user?.id]
  );

  useEffect(() => {
    if (!ablyReady || !session?.user?.id) return;

    const client = getAblyRealtimeClient();
    const notifChannel = client.channels.get(
      `notifications:${session.user.id}`
    );
    notifChannel.subscribe("new", handleNotification);

    return () => {
      notifChannel.unsubscribe("new", handleNotification);
    };
  }, [ablyReady, session?.user?.id, handleNotification]);

  useEffect(() => {
    if (!ablyReady || !session?.user?.id) return;

    const client = getAblyRealtimeClient();

    // Subscribe to all chat channels the client is already connected to
    // Chat messages arrive on chat:{conversationId} channels
    const handleChannelMessage = (channelName: string) => {
      const channel = client.channels.get(channelName);
      channel.subscribe("new", (msg) => {
        handleChatMessage({
          data: msg.data,
          name: channelName.replace("chat:", ""),
        });
      });
      return channel;
    };

    // Listen for any new chat channel attachments
    const channels: ReturnType<typeof client.channels.get>[] = [];

    // We'll listen on a personal chat notification channel instead
    const chatNotifChannel = client.channels.get(
      `chat-notify:${session.user.id}`
    );
    chatNotifChannel.subscribe("new", (msg) => {
      handleChatMessage({
        data: msg.data,
        name: msg.data.conversationId ?? "",
      });
    });
    channels.push(chatNotifChannel);

    return () => {
      channels.forEach((ch) => ch.unsubscribe());
    };
  }, [ablyReady, session?.user?.id, handleChatMessage]);

  return null;
}

export function ToastProvider() {
  const { resolvedTheme } = useTheme();

  return (
    <>
      <Toaster
        position="bottom-right"
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        richColors
      />
      <NotificationToastListener />
    </>
  );
}
