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

export interface ReactionGroup {
  emoji: string;
  userIds: string[];
}

export interface CommentData {
  id: string;
  content: string;
  createdAt: Date;
  editedAt?: Date | null;
  author: CommentAuthor;
  reactions?: ReactionGroup[];
  replies?: CommentData[];
}

export function useComments(postId: string, initialComments: CommentData[]) {
  const [comments, setComments] = useState<CommentData[]>(initialComments);
  const ablyReady = useAblyReady();

  // Sync when initialComments changes (e.g. after lazy-load fetch completes)
  useEffect(() => {
    if (initialComments.length > 0) {
      setComments(initialComments);
    }
  }, [initialComments]);

  const handleMessage = useCallback((event: InboundMessage) => {
    if (event.name === "new") {
      const data = event.data as Record<string, string | null>;
      const comment: CommentData = {
        id: data.id as string,
        content: data.content as string,
        createdAt: new Date(data.createdAt as string),
        author: JSON.parse(data.author as string),
        reactions: [],
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
    } else if (event.name === "reaction") {
      const data = event.data as { commentId: string; reactions: string };
      const commentId = data.commentId;
      const reactions: ReactionGroup[] = JSON.parse(data.reactions);

      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) return { ...c, reactions };
          if (c.replies?.some((r) => r.id === commentId)) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId ? { ...r, reactions } : r
              ),
            };
          }
          return c;
        })
      );
    } else if (event.name === "edit") {
      const data = event.data as { commentId: string; content: string };
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === data.commentId) return { ...c, content: data.content, editedAt: new Date() };
          if (c.replies?.some((r) => r.id === data.commentId)) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === data.commentId ? { ...r, content: data.content, editedAt: new Date() } : r
              ),
            };
          }
          return c;
        })
      );
    } else if (event.name === "delete") {
      const data = event.data as { commentId: string; parentId: string | null };
      setComments((prev) => {
        if (data.parentId) {
          return prev.map((c) =>
            c.id === data.parentId
              ? { ...c, replies: c.replies?.filter((r) => r.id !== data.commentId) }
              : c
          );
        }
        return prev.filter((c) => c.id !== data.commentId);
      });
    }
  }, []);

  useEffect(() => {
    if (!ablyReady) return;

    const client = getAblyRealtimeClient();
    const channel = client.channels.get(`comments:${postId}`);
    channel.subscribe(handleMessage);

    return () => {
      channel.unsubscribe(handleMessage);
    };
  }, [ablyReady, postId, handleMessage]);

  return { comments, setComments };
}
