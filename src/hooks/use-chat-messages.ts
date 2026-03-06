"use client";

import type * as Ably from "ably";
import { useChannel } from "ably/react";
import { useCallback, useState } from "react";
import type { MessageData } from "@/types/chat";

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
    }
  });

  const publishMessage = useCallback(
    (channel: { publish: (name: string, data: unknown) => void }, msg: MessageData) => {
      channel.publish("new", {
        ...msg,
        sender: JSON.stringify(msg.sender),
        editedAt: msg.editedAt?.toISOString() ?? null,
        deletedAt: msg.deletedAt?.toISOString() ?? null,
        createdAt: msg.createdAt.toISOString(),
      });
    },
    []
  );

  const publishEdit = useCallback(
    (channel: { publish: (name: string, data: unknown) => void }, msg: { id: string; content: string; editedAt: Date }) => {
      channel.publish("edit", {
        id: msg.id,
        content: msg.content,
        editedAt: msg.editedAt.toISOString(),
      });
    },
    []
  );

  const publishDelete = useCallback(
    (channel: { publish: (name: string, data: unknown) => void }, msg: { id: string; deletedAt: Date }) => {
      channel.publish("delete", {
        id: msg.id,
        deletedAt: msg.deletedAt.toISOString(),
      });
    },
    []
  );

  return { messages, setMessages, publishMessage, publishEdit, publishDelete, channelName };
}
