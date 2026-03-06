"use client";

import type * as Ably from "ably";
import { useChannel } from "ably/react";
import { useState } from "react";

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

  useChannel(`comments:${postId}`, (event: Ably.Message) => {
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
        // It's a reply — check if already exists in any parent's replies
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

      // Top-level comment — deduplicate
      if (prev.some((c) => c.id === comment.id)) return prev;
      return [...prev, comment];
    });
  });

  return { comments };
}
