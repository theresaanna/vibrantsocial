"use client";

import { useChannel } from "ably/react";
import { useCallback, useState } from "react";
import type { MessageData } from "@/types/chat";

interface AblyMessageEvent {
  name: string;
  data: {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    editedAt: string | null;
    deletedAt: string | null;
    createdAt: string;
    sender: MessageData["sender"];
  };
}

export function useChatMessages(
  conversationId: string,
  initialMessages: MessageData[]
) {
  const [messages, setMessages] = useState<MessageData[]>(initialMessages);
  const channelName = `chat:${conversationId}`;

  useChannel(channelName, (event: AblyMessageEvent) => {
    switch (event.name) {
      case "new": {
        const msg: MessageData = {
          ...event.data,
          editedAt: event.data.editedAt ? new Date(event.data.editedAt) : null,
          deletedAt: event.data.deletedAt
            ? new Date(event.data.deletedAt)
            : null,
          createdAt: new Date(event.data.createdAt),
        };
        setMessages((prev) => {
          // Deduplicate by ID
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        break;
      }
      case "edit": {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === event.data.id
              ? {
                  ...m,
                  content: event.data.content,
                  editedAt: new Date(event.data.editedAt!),
                }
              : m
          )
        );
        break;
      }
      case "delete": {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === event.data.id
              ? { ...m, deletedAt: new Date(event.data.deletedAt!) }
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
