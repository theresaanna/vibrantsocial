"use client";

import type { InboundMessage } from "ably";
import { useState, useEffect, useCallback } from "react";
import { getAblyRealtimeClient } from "@/lib/ably";
import { useAblyReady } from "@/app/providers";
import type { MessageData, MessageReplyTo, MediaType, ReactionGroup } from "@/types/chat";

export function useChatMessages(
  conversationId: string,
  initialMessages: MessageData[]
) {
  const [messages, setMessages] = useState<MessageData[]>(initialMessages);
  const channelName = `chat:${conversationId}`;
  const ablyReady = useAblyReady();

  const handleEvent = useCallback((event: InboundMessage) => {
    const data = event.data as Record<string, string | null>;
    switch (event.name) {
      case "new": {
        const replyTo: MessageReplyTo | null = data.replyTo
          ? JSON.parse(data.replyTo as string)
          : null;
        const msg: MessageData = {
          id: data.id as string,
          conversationId: data.conversationId as string,
          senderId: data.senderId as string,
          content: data.content as string,
          mediaUrl: (data.mediaUrl as string) ?? null,
          mediaType: (data.mediaType as MediaType) ?? null,
          mediaFileName: (data.mediaFileName as string) ?? null,
          mediaFileSize: data.mediaFileSize ? parseInt(data.mediaFileSize as string, 10) : null,
          sender: JSON.parse(data.sender as string),
          editedAt: data.editedAt ? new Date(data.editedAt) : null,
          deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
          createdAt: new Date(data.createdAt as string),
          reactions: [],
          replyTo,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        break;
      }
      case "edit": {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.id
              ? {
                  ...m,
                  content: data.content as string,
                  editedAt: new Date(data.editedAt as string),
                }
              : m
          )
        );
        break;
      }
      case "delete": {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.id
              ? { ...m, deletedAt: new Date(data.deletedAt as string) }
              : m
          )
        );
        break;
      }
      case "reaction": {
        const messageId = data.messageId as string;
        const reactions: ReactionGroup[] = JSON.parse(data.reactions as string);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, reactions } : m
          )
        );
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (!ablyReady) return;
    const client = getAblyRealtimeClient();
    const channel = client.channels.get(channelName);
    channel.subscribe(handleEvent);
    return () => {
      channel.unsubscribe(handleEvent);
    };
  }, [ablyReady, channelName, handleEvent]);

  return { messages, setMessages, channelName };
}
