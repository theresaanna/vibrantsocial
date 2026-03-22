"use client";

import type * as Ably from "ably";
import { useChannel } from "ably/react";
import { useState, useEffect, useCallback } from "react";
import { getAblyRealtimeClient } from "@/lib/ably";
import { getMessages } from "@/app/chat/actions";
import type { MessageData, MessageReplyTo, MediaType, ReactionGroup } from "@/types/chat";

export function useChatMessages(
  conversationId: string,
  initialMessages: MessageData[],
  currentUserId: string
) {
  const [messages, setMessages] = useState<MessageData[]>(initialMessages);
  const channelName = `chat:${conversationId}`;

  // Merge fetched messages with existing state (adds new, updates existing)
  const mergeMessages = useCallback((fetched: MessageData[]) => {
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newMsgs = fetched.filter((m) => !existingIds.has(m.id));
      if (newMsgs.length === 0) return prev;
      return [...prev, ...newMsgs];
    });
  }, []);

  // Primary: Ably per-conversation channel subscription
  useChannel(channelName, (event: Ably.Message) => {
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
  });

  // Fallback: listen to personal chat-notify channel for real-time triggers
  useEffect(() => {
    const client = getAblyRealtimeClient();
    const notifyChannel = client.channels.get(`chat-notify:${currentUserId}`);

    const handler = (msg: Ably.InboundMessage) => {
      const data = msg.data as { conversationId?: string };
      if (data.conversationId === conversationId) {
        getMessages(conversationId).then((result) => mergeMessages(result.messages));
      }
    };

    notifyChannel.subscribe("new", handler);
    return () => {
      notifyChannel.unsubscribe("new", handler);
    };
  }, [conversationId, currentUserId, mergeMessages]);

  // Fallback: refresh messages on window focus
  useEffect(() => {
    const handleFocus = () => {
      getMessages(conversationId).then((result) => mergeMessages(result.messages));
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [conversationId, mergeMessages]);

  return { messages, setMessages, channelName };
}
