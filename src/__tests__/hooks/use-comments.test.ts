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

interface ReactionGroup {
  emoji: string;
  userIds: string[];
}

interface CommentData {
  id: string;
  content: string;
  createdAt: Date;
  editedAt?: Date | null;
  author: CommentAuthor;
  reactions?: ReactionGroup[];
  replies?: CommentData[];
}

const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
let ablyReady = true;
let messageHandler: ((event: { name: string; data: Record<string, unknown> }) => void) | null = null;

function useComments(postId: string, initialComments: CommentData[]) {
  const [comments, setComments] = useState<CommentData[]>(initialComments);

  useEffect(() => {
    if (initialComments.length > 0) {
      setComments(initialComments);
    }
  }, [initialComments]);

  const handleMessage = useCallback(
    (event: { name: string; data: Record<string, unknown> }) => {
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
      } else if (event.name === "edit") {
        const data = event.data as { commentId: string; content: string };
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === data.commentId) return { ...c, content: data.content, editedAt: new Date() };
            if (c.replies?.some((r) => r.id === data.commentId)) {
              return { ...c, replies: c.replies.map((r) => r.id === data.commentId ? { ...r, content: data.content, editedAt: new Date() } : r) };
            }
            return c;
          })
        );
      } else if (event.name === "delete") {
        const data = event.data as { commentId: string; parentId: string | null };
        setComments((prev) => {
          if (data.parentId) {
            return prev.map((c) => c.id === data.parentId ? { ...c, replies: c.replies?.filter((r) => r.id !== data.commentId) } : c);
          }
          return prev.filter((c) => c.id !== data.commentId);
        });
      } else if (event.name === "reaction") {
        const data = event.data as { commentId: string; reactions: string };
        const reactions: ReactionGroup[] = JSON.parse(data.reactions);
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === data.commentId) return { ...c, reactions };
            if (c.replies?.some((r) => r.id === data.commentId)) {
              return { ...c, replies: c.replies.map((r) => r.id === data.commentId ? { ...r, reactions } : r) };
            }
            return c;
          })
        );
      }
    },
    []
  );

  useEffect(() => {
    if (!ablyReady) return;
    messageHandler = handleMessage;
    mockSubscribe(handleMessage);
    return () => { mockUnsubscribe(handleMessage); messageHandler = null; };
  }, [ablyReady, postId, handleMessage]);

  return { comments, setComments };
}

const author: CommentAuthor = { id: "author1", username: "alice", displayName: "Alice", name: null, image: null, avatar: null };

function makeComment(id: string, content: string, opts?: { replies?: CommentData[] }): CommentData {
  return { id, content, createdAt: new Date("2024-01-01"), author, replies: opts?.replies ?? [], reactions: [] };
}

describe("useComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ablyReady = true;
    messageHandler = null;
  });

  it("returns initial comments and subscribes", () => {
    const { result } = renderHook(() => useComments("post1", [makeComment("c1", "Hello")]));
    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].content).toBe("Hello");
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it("handles all real-time events (new, edit, delete, reaction)", () => {
    const initial = [
      makeComment("c1", "First", { replies: [makeComment("r1", "Reply")] }),
      makeComment("c2", "Second"),
    ];
    const { result } = renderHook(() => useComments("post1", initial));

    // New top-level comment
    act(() => {
      messageHandler!({
        name: "new",
        data: { id: "c3", content: "Third", createdAt: "2024-01-01T00:00:00Z", author: JSON.stringify(author), parentId: null },
      });
    });
    expect(result.current.comments).toHaveLength(3);

    // New reply
    act(() => {
      messageHandler!({
        name: "new",
        data: { id: "r2", content: "Reply 2", createdAt: "2024-01-01T00:00:00Z", author: JSON.stringify(author), parentId: "c2" },
      });
    });
    expect(result.current.comments[1].replies).toHaveLength(1);

    // Edit top-level
    act(() => {
      messageHandler!({ name: "edit", data: { commentId: "c1", content: "Updated" } });
    });
    expect(result.current.comments[0].content).toBe("Updated");
    expect(result.current.comments[0].editedAt).toBeTruthy();

    // Edit reply
    act(() => {
      messageHandler!({ name: "edit", data: { commentId: "r1", content: "Reply updated" } });
    });
    expect(result.current.comments[0].replies![0].content).toBe("Reply updated");

    // Reaction on top-level
    act(() => {
      messageHandler!({
        name: "reaction",
        data: { commentId: "c2", reactions: JSON.stringify([{ emoji: "👍", userIds: ["u1"], userNames: ["Alice"] }]) },
      });
    });
    expect(result.current.comments[1].reactions).toEqual([{ emoji: "👍", userIds: ["u1"], userNames: ["Alice"] }]);

    // Reaction on reply
    act(() => {
      messageHandler!({
        name: "reaction",
        data: { commentId: "r1", reactions: JSON.stringify([{ emoji: "❤️", userIds: ["u2"], userNames: ["Bob"] }]) },
      });
    });
    expect(result.current.comments[0].replies![0].reactions).toEqual([{ emoji: "❤️", userIds: ["u2"], userNames: ["Bob"] }]);

    // Delete reply
    act(() => {
      messageHandler!({ name: "delete", data: { commentId: "r1", parentId: "c1" } });
    });
    expect(result.current.comments[0].replies).toHaveLength(0);

    // Delete top-level
    act(() => {
      messageHandler!({ name: "delete", data: { commentId: "c3", parentId: null } });
    });
    expect(result.current.comments).toHaveLength(2);

    // Deduplication
    act(() => {
      messageHandler!({
        name: "new",
        data: { id: "c1", content: "Updated", createdAt: "2024-01-01T00:00:00Z", author: JSON.stringify(author), parentId: null },
      });
    });
    expect(result.current.comments).toHaveLength(2);
  });
});
