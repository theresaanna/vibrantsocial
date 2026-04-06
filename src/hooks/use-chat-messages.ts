"use client";

import type { InboundMessage } from "ably";
import { useState, useEffect, useCallback } from "react";
import { getAblyRealtimeClient } from "@/lib/ably";
import { useAblyReady } from "@/app/providers";
import { rpc } from "@/lib/rpc";
import type { MessageData, MessageReplyTo, MediaType, ReactionGroup } from "@/types/chat";

export function useChatMessages(
  conversationId: string,
  initialMessages: MessageData[],
  currentUserId: string
) {
  const [messages, setMessages] = useState<MessageData[]>(initialMessages);
  const channelName = `chat:${conversationId}`;
  const ablyReady = useAblyReady();

  // Merge fetched messages with existing state (adds new, updates existing)
  const mergeMessages = useCallback((fetched: MessageData[]) => {
    setMessages((prev) => {
      const fetchedMap = new Map(fetched.map((m) => [m.id, m]));
      let changed = false;

      // Update existing messages with fresh server data (reactions, edits, deletes)
      const updated = prev.map((m) => {
        const fresh = fetchedMap.get(m.id);
        if (!fresh) return m;
        fetchedMap.delete(m.id);
        // Check if anything actually changed to avoid unnecessary re-renders
        if (
          m.content === fresh.content &&
          m.editedAt?.toString() === fresh.editedAt?.toString() &&
          m.deletedAt?.toString() === fresh.deletedAt?.toString() &&
          JSON.stringify(m.reactions) === JSON.stringify(fresh.reactions)
        ) {
          return m;
        }
        changed = true;
        return { ...m, ...fresh };
      });

      // Append any truly new messages
      const newMsgs = Array.from(fetchedMap.values());
      if (newMsgs.length > 0) {
        changed = true;
      }

      return changed ? [...updated, ...newMsgs] : prev;
    });
  }, []);

  // Primary: Ably per-conversation channel subscription
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
          isNsfw: false,
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
      case "nsfw-update": {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.id ? { ...m, isNsfw: true } : m
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

  // Fallback: listen to personal chat-notify channel for real-time triggers
  useEffect(() => {
    if (!ablyReady) return;
    const client = getAblyRealtimeClient();
    const notifyChannel = client.channels.get(`chat-notify:${currentUserId}`);

    const handler = (msg: InboundMessage) => {
      const data = msg.data as { conversationId?: string };
      if (data.conversationId === conversationId) {
        rpc<{ messages: MessageData[]; nextCursor: string | null }>("getMessages", conversationId).then((result) => mergeMessages(result.messages));
      }
    };

    notifyChannel.subscribe("new", handler);
    return () => {
      notifyChannel.unsubscribe("new", handler);
    };
  }, [ablyReady, conversationId, currentUserId, mergeMessages]);

  // Fallback: refresh messages on window focus
  useEffect(() => {
    const handleFocus = () => {
      rpc<{ messages: MessageData[]; nextCursor: string | null }>("getMessages", conversationId).then((result) => mergeMessages(result.messages));
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [conversationId, mergeMessages]);

  return { messages, setMessages, channelName };
}
