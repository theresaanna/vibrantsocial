"use client";

import type { InboundMessage } from "ably";
import { useState, useEffect, useCallback } from "react";
import { useAblyReady } from "@/app/providers";
import { getAblyRealtimeClient } from "@/lib/ably";

interface CommentAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatar: string | null;
}

export interface CommentData {
  id: string;
  content: string;
  createdAt: Date;
  author: CommentAuthor;
  replies?: CommentData[];
}

export function useComments(postId: string, initialComments: CommentData[]) {
  const [comments, setComments] = useState<CommentData[]>(initialComments);
  const ablyReady = useAblyReady();

  const handleMessage = useCallback((event: InboundMessage) => {
    if (event.name !== "new") return;

    const data = event.data as Record<string, string | null>;
    const comment: CommentData = {
      id: data.id as string,
      content: data.content as string,
      createdAt: new Date(data.createdAt as string),
      author: JSON.parse(data.author as string),
    };
    const parentId = data.parentId || null;

    setComments((prev) => {
      if (parentId) {
        const alreadyExists = prev.some((c) =>
          c.replies?.some((r) => r.id === comment.id)
        );
        if (alreadyExists) return prev;

        return prev.map((c) =>
          c.id === parentId
            ? { ...c, replies: [...(c.replies || []), comment] }
            : c
        );
      }

      if (prev.some((c) => c.id === comment.id)) return prev;
      return [...prev, comment];
    });
  }, []);

  useEffect(() => {
    if (!ablyReady) return;

    const client = getAblyRealtimeClient();
    const channel = client.channels.get(`comments:${postId}`);
    channel.subscribe("new", handleMessage);

    return () => {
      channel.unsubscribe("new", handleMessage);
    };
  }, [ablyReady, postId, handleMessage]);

  return { comments };
}
