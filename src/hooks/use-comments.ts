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
  profileFrameId: string | null;
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
  parentId?: string | null;
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
    // Recursive helpers for deep comment trees
    function findComment(list: CommentData[], id: string): boolean {
      return list.some(
        (c) => c.id === id || (c.replies && findComment(c.replies, id))
      );
    }

    function addReply(list: CommentData[], parentId: string, reply: CommentData): CommentData[] {
      return list.map((c) => {
        if (c.id === parentId) {
          return { ...c, replies: [...(c.replies || []), reply] };
        }
        if (c.replies) {
          return { ...c, replies: addReply(c.replies, parentId, reply) };
        }
        return c;
      });
    }

    function updateComment(
      list: CommentData[],
      id: string,
      updater: (c: CommentData) => CommentData
    ): CommentData[] {
      return list.map((c) => {
        if (c.id === id) return updater(c);
        if (c.replies) {
          return { ...c, replies: updateComment(c.replies, id, updater) };
        }
        return c;
      });
    }

    function removeComment(list: CommentData[], id: string): CommentData[] {
      return list
        .filter((c) => c.id !== id)
        .map((c) =>
          c.replies ? { ...c, replies: removeComment(c.replies, id) } : c
        );
    }

    if (event.name === "new") {
      const data = event.data as Record<string, string | null>;
      const parentId = data.parentId || null;
      const comment: CommentData = {
        id: data.id as string,
        content: data.content as string,
        createdAt: new Date(data.createdAt as string),
        parentId,
        author: JSON.parse(data.author as string),
        reactions: [],
      };

      setComments((prev) => {
        if (findComment(prev, comment.id)) return prev;
        if (parentId) {
          return addReply(prev, parentId, comment);
        }
        return [...prev, comment];
      });
    } else if (event.name === "reaction") {
      const data = event.data as { commentId: string; reactions: string };
      const reactions: ReactionGroup[] = JSON.parse(data.reactions);

      setComments((prev) =>
        updateComment(prev, data.commentId, (c) => ({ ...c, reactions }))
      );
    } else if (event.name === "edit") {
      const data = event.data as { commentId: string; content: string };
      setComments((prev) =>
        updateComment(prev, data.commentId, (c) => ({
          ...c,
          content: data.content,
          editedAt: new Date(),
        }))
      );
    } else if (event.name === "delete") {
      const data = event.data as { commentId: string; parentId: string | null };
      setComments((prev) => removeComment(prev, data.commentId));
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
