"use client";

import type * as Ably from "ably";
import { useChannel } from "ably/react";
import { useState } from "react";
import type { MessageData, ReactionGroup } from "@/types/chat";

export function useChatMessages(
  conversationId: string,
  initialMessages: MessageData[]
) {
  const [messages, setMessages] = useState<MessageData[]>(initialMessages);
  const channelName = `chat:${conversationId}`;

  useChannel(channelName, (event: Ably.Message) => {
    const data = event.data as Record<string, string | null>;
    switch (event.name) {
      case "new": {
        const msg: MessageData = {
          id: data.id as string,
          conversationId: data.conversationId as string,
          senderId: data.senderId as string,
          content: data.content as string,
          sender: JSON.parse(data.sender as string),
          editedAt: data.editedAt ? new Date(data.editedAt) : null,
          deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
          createdAt: new Date(data.createdAt as string),
          reactions: [],
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

  return { messages, setMessages, channelName };
}
