/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState, useEffect, useCallback } from "react";

interface CommentAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatar: string | null;
}

interface CommentData {
  id: string;
  content: string;
  createdAt: Date;
  author: CommentAuthor;
  replies?: CommentData[];
}

const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
let ablyReady = true;

function useComments(postId: string, initialComments: CommentData[]) {
  const [comments, setComments] = useState<CommentData[]>(initialComments);

  useEffect(() => {
    if (initialComments.length > 0) {
      setComments(initialComments);
    }
  }, [initialComments]);

  const handleMessage = useCallback((event: { name: string; data: Record<string, string | null> }) => {
    if (event.name !== "new") return;

    const data = event.data;
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

    const channel = {
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
    };
    channel.subscribe("new", handleMessage);

    return () => {
      channel.unsubscribe("new", handleMessage);
    };
  }, [ablyReady, postId, handleMessage]);

  return { comments };
}

function makeComment(id: string, content: string): CommentData {
  return {
    id,
    content,
    createdAt: new Date("2024-01-01"),
    author: {
      id: "author1",
      username: "alice",
      displayName: "Alice",
      name: null,
      image: null,
      avatar: null,
    },
    replies: [],
  };
}

describe("useComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ablyReady = true;
  });

  it("returns initial comments", () => {
    const initialComments = [makeComment("c1", "Hello")];
    const { result } = renderHook(() => useComments("post1", initialComments));
    expect(result.current.comments).toEqual(initialComments);
  });

  it("subscribes to Ably channel when ready", () => {
    renderHook(() => useComments("post1", []));
    expect(mockSubscribe).toHaveBeenCalledWith("new", expect.any(Function));
  });
});
