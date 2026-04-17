import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatMessages } from "@/hooks/use-chat-messages";
import type { MessageData } from "@/types/chat";

let channelCallback: (event: { name: string; data: Record<string, string | null> }) => void;

vi.mock("@/app/providers", () => ({
  useAblyReady: vi.fn(() => true),
}));

vi.mock("@/lib/ably", () => ({
  getAblyRealtimeClient: vi.fn(() => ({
    channels: {
      get: vi.fn(() => ({
        subscribe: vi.fn((cbOrEvent: string | ((...args: unknown[]) => void), maybeCb?: (...args: unknown[]) => void) => {
          // When called with just a callback (primary channel), capture it
          if (typeof cbOrEvent === "function") {
            channelCallback = cbOrEvent as typeof channelCallback;
          }
          // When called with event name + callback (notify channel), ignore
          void maybeCb;
        }),
        unsubscribe: vi.fn(),
      })),
    },
  })),
}));

const mockGetMessages = vi.fn(() => Promise.resolve({ messages: [] as MessageData[], nextCursor: null }));

vi.mock("@/app/messages/actions", () => ({
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
}));

const makeSender = () => JSON.stringify({
  id: "sender1",
  username: "alice",
  displayName: "Alice",
  name: "Alice",
  avatar: null,
  image: null,
});

const makeMessage = (id: string, content = "hello"): MessageData => ({
  id,
  conversationId: "conv1",
  senderId: "sender1",
  content,
  mediaUrl: null,
  mediaType: null,
  mediaFileName: null,
  mediaFileSize: null,
  isNsfw: false,
  replyTo: null,
  editedAt: null,
  deletedAt: null,
  createdAt: new Date("2024-01-01T10:00:00Z"),
  reactions: [],
  sender: {
    id: "sender1",
    username: "alice",
    displayName: "Alice",
    name: "Alice",
    avatar: null,
    image: null,
    profileFrameId: null,
  },
});

describe("useChatMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with provided messages", () => {
    const initial = [makeMessage("m1"), makeMessage("m2")];
    const { result } = renderHook(() => useChatMessages("conv1", initial, "currentUser"));
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].id).toBe("m1");
    expect(result.current.messages[1].id).toBe("m2");
  });

  it("returns correct channelName", () => {
    const { result } = renderHook(() => useChatMessages("conv1", [], "currentUser"));
    expect(result.current.channelName).toBe("chat:conv1");
  });

  it("adds message on 'new' event", () => {
    const { result } = renderHook(() => useChatMessages("conv1", [], "currentUser"));

    act(() => {
      channelCallback({
        name: "new",
        data: {
          id: "m1",
          conversationId: "conv1",
          senderId: "sender1",
          content: "hello",
          sender: makeSender(),
          editedAt: null,
          deletedAt: null,
          createdAt: "2024-01-01T10:00:00Z",
        },
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe("m1");
    expect(result.current.messages[0].content).toBe("hello");
  });

  it("deduplicates messages with same ID", () => {
    const initial = [makeMessage("m1")];
    const { result } = renderHook(() => useChatMessages("conv1", initial, "currentUser"));

    act(() => {
      channelCallback({
        name: "new",
        data: {
          id: "m1",
          conversationId: "conv1",
          senderId: "sender1",
          content: "hello",
          sender: makeSender(),
          editedAt: null,
          deletedAt: null,
          createdAt: "2024-01-01T10:00:00Z",
        },
      });
    });

    expect(result.current.messages).toHaveLength(1);
  });

  it("updates content and editedAt on 'edit' event", () => {
    const initial = [makeMessage("m1", "original")];
    const { result } = renderHook(() => useChatMessages("conv1", initial, "currentUser"));

    act(() => {
      channelCallback({
        name: "edit",
        data: {
          id: "m1",
          content: "edited",
          editedAt: "2024-01-01T11:00:00Z",
        },
      });
    });

    expect(result.current.messages[0].content).toBe("edited");
    expect(result.current.messages[0].editedAt).toEqual(new Date("2024-01-01T11:00:00Z"));
  });

  it("does not modify messages on edit with unknown ID", () => {
    const initial = [makeMessage("m1", "original")];
    const { result } = renderHook(() => useChatMessages("conv1", initial, "currentUser"));

    act(() => {
      channelCallback({
        name: "edit",
        data: {
          id: "m999",
          content: "edited",
          editedAt: "2024-01-01T11:00:00Z",
        },
      });
    });

    expect(result.current.messages[0].content).toBe("original");
  });

  it("sets deletedAt on 'delete' event", () => {
    const initial = [makeMessage("m1")];
    const { result } = renderHook(() => useChatMessages("conv1", initial, "currentUser"));

    act(() => {
      channelCallback({
        name: "delete",
        data: {
          id: "m1",
          deletedAt: "2024-01-01T12:00:00Z",
        },
      });
    });

    expect(result.current.messages[0].deletedAt).toEqual(new Date("2024-01-01T12:00:00Z"));
  });

  it("updates reactions on 'reaction' event", () => {
    const initial = [makeMessage("m1")];
    const { result } = renderHook(() => useChatMessages("conv1", initial, "currentUser"));

    act(() => {
      channelCallback({
        name: "reaction",
        data: {
          messageId: "m1",
          reactions: JSON.stringify([
            { emoji: "\u{1F44D}", userIds: ["user1", "user2"], userNames: ["User 1", "User 2"] },
          ]),
        },
      });
    });

    expect(result.current.messages[0].reactions).toEqual([
      { emoji: "\u{1F44D}", userIds: ["user1", "user2"], userNames: ["User 1", "User 2"] },
    ]);
  });

  it("does not modify other messages on 'reaction' event", () => {
    const initial = [makeMessage("m1"), makeMessage("m2")];
    const { result } = renderHook(() => useChatMessages("conv1", initial, "currentUser"));

    act(() => {
      channelCallback({
        name: "reaction",
        data: {
          messageId: "m1",
          reactions: JSON.stringify([
            { emoji: "\u{2764}\u{FE0F}", userIds: ["user1"], userNames: ["User 1"] },
          ]),
        },
      });
    });

    expect(result.current.messages[0].reactions).toHaveLength(1);
    expect(result.current.messages[1].reactions).toHaveLength(0);
  });

  it("sets reactions to empty array for new messages", () => {
    const { result } = renderHook(() => useChatMessages("conv1", [], "currentUser"));

    act(() => {
      channelCallback({
        name: "new",
        data: {
          id: "m1",
          conversationId: "conv1",
          senderId: "sender1",
          content: "hello",
          sender: makeSender(),
          editedAt: null,
          deletedAt: null,
          createdAt: "2024-01-01T10:00:00Z",
        },
      });
    });

    expect(result.current.messages[0].reactions).toEqual([]);
  });

  it("includes media fields on 'new' event with media", () => {
    const { result } = renderHook(() => useChatMessages("conv1", [], "currentUser"));

    act(() => {
      channelCallback({
        name: "new",
        data: {
          id: "m1",
          conversationId: "conv1",
          senderId: "sender1",
          content: "check this out",
          sender: makeSender(),
          editedAt: null,
          deletedAt: null,
          createdAt: "2024-01-01T10:00:00Z",
          mediaUrl: "https://example.com/photo.jpg",
          mediaType: "image",
          mediaFileName: "photo.jpg",
          mediaFileSize: "500000",
        },
      });
    });

    expect(result.current.messages[0].mediaUrl).toBe("https://example.com/photo.jpg");
    expect(result.current.messages[0].mediaType).toBe("image");
    expect(result.current.messages[0].mediaFileName).toBe("photo.jpg");
    expect(result.current.messages[0].mediaFileSize).toBe(500000);
  });

  it("sets media fields to null on 'new' event without media", () => {
    const { result } = renderHook(() => useChatMessages("conv1", [], "currentUser"));

    act(() => {
      channelCallback({
        name: "new",
        data: {
          id: "m1",
          conversationId: "conv1",
          senderId: "sender1",
          content: "hello",
          sender: makeSender(),
          editedAt: null,
          deletedAt: null,
          createdAt: "2024-01-01T10:00:00Z",
        },
      });
    });

    expect(result.current.messages[0].mediaUrl).toBeNull();
    expect(result.current.messages[0].mediaType).toBeNull();
    expect(result.current.messages[0].mediaFileName).toBeNull();
    expect(result.current.messages[0].mediaFileSize).toBeNull();
  });

  it("mergeMessages updates reactions on existing messages on window focus", async () => {
    const initial = [makeMessage("m1")];
    const updatedMsg = {
      ...makeMessage("m1"),
      reactions: [{ emoji: "\u{1F44D}", userIds: ["user1"], userNames: ["User 1"] }],
    };
    mockGetMessages.mockResolvedValueOnce({ messages: [updatedMsg], nextCursor: null });

    const { result } = renderHook(() => useChatMessages("conv1", initial, "currentUser"));
    expect(result.current.messages[0].reactions).toEqual([]);

    // Trigger window focus
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      // Let the promise resolve
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.messages[0].reactions).toEqual([
      { emoji: "\u{1F44D}", userIds: ["user1"] },
    ]);
  });

  it("mergeMessages updates edits on existing messages on window focus", async () => {
    const initial = [makeMessage("m1", "original")];
    const updatedMsg = {
      ...makeMessage("m1", "edited"),
      editedAt: new Date("2024-01-01T11:00:00Z"),
    };
    mockGetMessages.mockResolvedValueOnce({ messages: [updatedMsg], nextCursor: null });

    const { result } = renderHook(() => useChatMessages("conv1", initial, "currentUser"));

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.messages[0].content).toBe("edited");
    expect(result.current.messages[0].editedAt).toEqual(new Date("2024-01-01T11:00:00Z"));
  });

  it("mergeMessages adds new messages alongside existing ones on focus", async () => {
    const initial = [makeMessage("m1")];
    const newMsg = makeMessage("m2", "new message");
    mockGetMessages.mockResolvedValueOnce({ messages: [makeMessage("m1"), newMsg], nextCursor: null });

    const { result } = renderHook(() => useChatMessages("conv1", initial, "currentUser"));
    expect(result.current.messages).toHaveLength(1);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].id).toBe("m2");
  });

  it("mergeMessages does not re-render when nothing changed", async () => {
    const initial = [makeMessage("m1")];
    mockGetMessages.mockResolvedValueOnce({ messages: [makeMessage("m1")], nextCursor: null });

    const { result } = renderHook(() => useChatMessages("conv1", initial, "currentUser"));
    const messagesBefore = result.current.messages;

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await new Promise((r) => setTimeout(r, 0));
    });

    // Same reference means no re-render
    expect(result.current.messages).toBe(messagesBefore);
  });
});
