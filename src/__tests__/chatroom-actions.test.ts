import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatRoomMessage: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: {},
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/ably", () => ({
  getAblyRestClient: () => ({
    channels: {
      get: () => ({ publish: vi.fn() }),
    },
  }),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import {
  sendChatRoomMessage,
  editChatRoomMessage,
  deleteChatRoomMessage,
  getChatRoomMessages,
} from "@/app/chatroom/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

// ---------------------------------------------------------------------------
// sendChatRoomMessage
// ---------------------------------------------------------------------------
describe("sendChatRoomMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await sendChatRoomMessage("hello");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Not authenticated");
  });

  it("returns error when rate limited", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(isRateLimited).mockResolvedValueOnce(true);
    const result = await sendChatRoomMessage("hello");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Too many requests");
  });

  it("returns error for empty message", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const result = await sendChatRoomMessage("   ");
    expect(result.success).toBe(false);
    expect(result.message).toContain("cannot be empty");
  });

  it("returns error for message exceeding max length", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const result = await sendChatRoomMessage("a".repeat(2001));
    expect(result.success).toBe(false);
    expect(result.message).toContain("too long");
  });

  it("creates message successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.chatRoomMessage.create.mockResolvedValue({
      id: "msg1",
      room: "lobby",
      senderId: "u1",
      content: "hello world",
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: { id: "u1", username: "alice", displayName: "Alice", name: null, avatar: null, image: null, profileFrameId: null, usernameFont: null },
    } as never);

    const result = await sendChatRoomMessage("hello world");
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg1");
    expect(mockPrisma.chatRoomMessage.create).toHaveBeenCalledWith({
      data: { room: "lobby", senderId: "u1", content: "hello world" },
      include: { sender: { select: expect.any(Object) } },
    });
  });

  it("trims whitespace from message content", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.chatRoomMessage.create.mockResolvedValue({
      id: "msg1",
      room: "lobby",
      senderId: "u1",
      content: "hello",
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: { id: "u1", username: "alice", displayName: null, name: null, avatar: null, image: null, profileFrameId: null, usernameFont: null },
    } as never);

    await sendChatRoomMessage("  hello  ");
    expect(mockPrisma.chatRoomMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ content: "hello" }) })
    );
  });

  it("uses provided room name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.chatRoomMessage.create.mockResolvedValue({
      id: "msg1",
      room: "gaming",
      senderId: "u1",
      content: "gg",
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: { id: "u1", username: "alice", displayName: null, name: null, avatar: null, image: null, profileFrameId: null, usernameFont: null },
    } as never);

    await sendChatRoomMessage("gg", "gaming");
    expect(mockPrisma.chatRoomMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ room: "gaming" }) })
    );
  });
});

// ---------------------------------------------------------------------------
// editChatRoomMessage
// ---------------------------------------------------------------------------
describe("editChatRoomMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await editChatRoomMessage("msg1", "new content");
    expect(result.success).toBe(false);
  });

  it("returns error for empty content", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const result = await editChatRoomMessage("msg1", "   ");
    expect(result.success).toBe(false);
    expect(result.message).toContain("cannot be empty");
  });

  it("returns error when message not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.chatRoomMessage.findUnique.mockResolvedValue(null);
    const result = await editChatRoomMessage("msg1", "new content");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("returns error when editing someone else's message", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.chatRoomMessage.findUnique.mockResolvedValue({
      id: "msg1",
      senderId: "u2",
      room: "lobby",
      deletedAt: null,
    } as never);
    const result = await editChatRoomMessage("msg1", "new content");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not yours");
  });

  it("returns error when editing a deleted message", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.chatRoomMessage.findUnique.mockResolvedValue({
      id: "msg1",
      senderId: "u1",
      room: "lobby",
      deletedAt: new Date(),
    } as never);
    const result = await editChatRoomMessage("msg1", "new content");
    expect(result.success).toBe(false);
    expect(result.message).toContain("deleted");
  });

  it("edits message successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.chatRoomMessage.findUnique.mockResolvedValue({
      id: "msg1",
      senderId: "u1",
      room: "lobby",
      deletedAt: null,
    } as never);
    mockPrisma.chatRoomMessage.update.mockResolvedValue({
      id: "msg1",
      content: "updated",
      editedAt: new Date(),
    } as never);

    const result = await editChatRoomMessage("msg1", "updated");
    expect(result.success).toBe(true);
    expect(mockPrisma.chatRoomMessage.update).toHaveBeenCalledWith({
      where: { id: "msg1" },
      data: { content: "updated", editedAt: expect.any(Date) },
    });
  });
});

// ---------------------------------------------------------------------------
// deleteChatRoomMessage
// ---------------------------------------------------------------------------
describe("deleteChatRoomMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await deleteChatRoomMessage("msg1");
    expect(result.success).toBe(false);
  });

  it("returns error when message not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.chatRoomMessage.findUnique.mockResolvedValue(null);
    const result = await deleteChatRoomMessage("msg1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("returns error when deleting someone else's message", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.chatRoomMessage.findUnique.mockResolvedValue({
      id: "msg1",
      senderId: "u2",
      room: "lobby",
    } as never);
    const result = await deleteChatRoomMessage("msg1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not yours");
  });

  it("soft-deletes message successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.chatRoomMessage.findUnique.mockResolvedValue({
      id: "msg1",
      senderId: "u1",
      room: "lobby",
    } as never);
    mockPrisma.chatRoomMessage.update.mockResolvedValue({} as never);

    const result = await deleteChatRoomMessage("msg1");
    expect(result.success).toBe(true);
    expect(mockPrisma.chatRoomMessage.update).toHaveBeenCalledWith({
      where: { id: "msg1" },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

// ---------------------------------------------------------------------------
// getChatRoomMessages
// ---------------------------------------------------------------------------
describe("getChatRoomMessages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await getChatRoomMessages("lobby");
    expect(result).toEqual({ messages: [], nextCursor: null });
  });

  it("returns messages in chronological order", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const mockMessages = [
      { id: "msg2", createdAt: new Date("2026-01-02"), sender: { id: "u1" } },
      { id: "msg1", createdAt: new Date("2026-01-01"), sender: { id: "u1" } },
    ];
    mockPrisma.chatRoomMessage.findMany.mockResolvedValue(mockMessages as never);

    const result = await getChatRoomMessages("lobby");
    // Should be reversed to chronological (oldest first)
    expect(result.messages[0].id).toBe("msg1");
    expect(result.messages[1].id).toBe("msg2");
    expect(result.nextCursor).toBeNull();
  });

  it("returns cursor when more messages exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    // Return 51 messages (PAGE_SIZE + 1)
    const mockMessages = Array.from({ length: 51 }, (_, i) => ({
      id: `msg${i}`,
      createdAt: new Date(`2026-01-${String(i + 1).padStart(2, "0")}`),
      sender: { id: "u1" },
    }));
    mockPrisma.chatRoomMessage.findMany.mockResolvedValue(mockMessages as never);

    const result = await getChatRoomMessages("lobby");
    expect(result.messages).toHaveLength(50);
    expect(result.nextCursor).not.toBeNull();
  });
});
