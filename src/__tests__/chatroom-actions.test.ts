import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatRoom: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    chatRoomMessage: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    chatRoomModerator: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    chatRoomMute: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    chatRoomMessageReaction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
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

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { send: vi.fn() },
}));

vi.mock("@/lib/cache", () => ({
  cached: <T>(_key: string, fn: () => Promise<T>) => fn(),
  cacheKeys: {
    activeChatRooms: (limit: number, nsfw: boolean) => `chatrooms:active:${limit}:${nsfw ? 1 : 0}`,
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { inngest } from "@/lib/inngest";
import {
  sendChatRoomMessage,
  editChatRoomMessage,
  deleteChatRoomMessage,
  getChatRoomMessages,
  getChatRoomMeta,
  toggleReaction,
  addModerator,
  removeModerator,
  muteUser,
  unmuteUser,
  setChatRoomStatus,
  searchChatRoomUsers,
} from "@/app/communities/chatrooms/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

const ROOM = { id: "room1", slug: "lobby", name: "Lounge", status: null, ownerId: "owner1", createdAt: new Date(), updatedAt: new Date() };
const SENDER = { id: "u1", username: "alice", displayName: "Alice", name: null, avatar: null, image: null, profileFrameId: null, usernameFont: null };

function setupRoom() {
  (mockPrisma.chatRoom.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(ROOM);
}

function setupAuth(userId = "u1") {
  mockAuth.mockResolvedValue({ user: { id: userId } } as never);
}

function setupNoAuth() {
  mockAuth.mockResolvedValue(null as never);
}

function setupNotMuted() {
  (mockPrisma.chatRoomMute.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

// ---------------------------------------------------------------------------
// sendChatRoomMessage
// ---------------------------------------------------------------------------
describe("sendChatRoomMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    setupNoAuth();
    const result = await sendChatRoomMessage("hello");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Not authenticated");
  });

  it("returns error when rate limited", async () => {
    setupAuth();
    vi.mocked(isRateLimited).mockResolvedValueOnce(true);
    const result = await sendChatRoomMessage("hello");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Too many requests");
  });

  it("returns error for empty message without media", async () => {
    setupAuth();
    const result = await sendChatRoomMessage("   ");
    expect(result.success).toBe(false);
    expect(result.message).toContain("cannot be empty");
  });

  it("returns error for message exceeding max length", async () => {
    setupAuth();
    const result = await sendChatRoomMessage("a".repeat(2001));
    expect(result.success).toBe(false);
    expect(result.message).toContain("too long");
  });

  it("returns error when user is muted", async () => {
    setupAuth();
    setupRoom();
    (mockPrisma.chatRoomMute.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "mute1",
      roomId: ROOM.id,
      userId: "u1",
      expiresAt: null,
    });
    const result = await sendChatRoomMessage("hello");
    expect(result.success).toBe(false);
    expect(result.message).toContain("muted");
  });

  it("creates message successfully", async () => {
    setupAuth();
    setupRoom();
    setupNotMuted();
    const now = new Date();
    (mockPrisma.chatRoomMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      roomId: ROOM.id,
      senderId: "u1",
      content: "hello world",
      mediaUrl: null,
      mediaType: null,
      mediaFileName: null,
      mediaFileSize: null,
      replyToId: null,
      editedAt: null,
      deletedAt: null,
      createdAt: now,
      sender: SENDER,
      replyTo: null,
      reactions: [],
    });

    const result = await sendChatRoomMessage("hello world");
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg1");
  });

  it("trims whitespace from message content", async () => {
    setupAuth();
    setupRoom();
    setupNotMuted();
    (mockPrisma.chatRoomMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      roomId: ROOM.id,
      senderId: "u1",
      content: "hello",
      mediaUrl: null,
      mediaType: null,
      mediaFileName: null,
      mediaFileSize: null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: SENDER,
      replyTo: null,
      reactions: [],
    });

    await sendChatRoomMessage("  hello  ");
    expect(mockPrisma.chatRoomMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ content: "hello" }) })
    );
  });

  it("allows empty content when media is attached", async () => {
    setupAuth();
    setupRoom();
    setupNotMuted();
    (mockPrisma.chatRoomMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      roomId: ROOM.id,
      senderId: "u1",
      content: "",
      mediaUrl: "https://example.com/img.jpg",
      mediaType: "image",
      mediaFileName: "img.jpg",
      mediaFileSize: 1000,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: SENDER,
      replyTo: null,
      reactions: [],
    });

    const result = await sendChatRoomMessage("", "lobby", {
      mediaUrl: "https://example.com/img.jpg",
      mediaType: "image",
      mediaFileName: "img.jpg",
      mediaFileSize: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("creates mention notifications for @mentioned users", async () => {
    setupAuth();
    setupRoom();
    setupNotMuted();
    (mockPrisma.chatRoomMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      roomId: ROOM.id,
      senderId: "u1",
      content: "hey @bob check this",
      mediaUrl: null,
      mediaType: null,
      mediaFileName: null,
      mediaFileSize: null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: SENDER,
      replyTo: null,
      reactions: [],
    });
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "u2" },
    ]);

    await sendChatRoomMessage("hey @bob check this");
    expect(createNotification).toHaveBeenCalledWith({
      type: "CHATROOM_MENTION",
      actorId: "u1",
      targetUserId: "u2",
      messageId: "msg1",
    });
  });

  it("does not notify self on self-mention", async () => {
    setupAuth();
    setupRoom();
    setupNotMuted();
    (mockPrisma.chatRoomMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      roomId: ROOM.id,
      senderId: "u1",
      content: "hey @alice",
      mediaUrl: null,
      mediaType: null,
      mediaFileName: null,
      mediaFileSize: null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: SENDER,
      replyTo: null,
      reactions: [],
    });
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "u1" }, // Same user
    ]);

    await sendChatRoomMessage("hey @alice");
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("passes replyToId and media options", async () => {
    setupAuth();
    setupRoom();
    setupNotMuted();
    (mockPrisma.chatRoomMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      roomId: ROOM.id,
      senderId: "u1",
      content: "reply",
      mediaUrl: "https://img.com/1.jpg",
      mediaType: "image",
      mediaFileName: "1.jpg",
      mediaFileSize: 500,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: SENDER,
      replyTo: { id: "msg0", content: "original", senderId: "u2", deletedAt: null, sender: { id: "u2", username: "bob", displayName: "Bob", name: null } },
      reactions: [],
    });

    await sendChatRoomMessage("reply", "lobby", {
      replyToId: "msg0",
      mediaUrl: "https://img.com/1.jpg",
      mediaType: "image",
      mediaFileName: "1.jpg",
      mediaFileSize: 500,
    });
    expect(mockPrisma.chatRoomMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          replyToId: "msg0",
          mediaUrl: "https://img.com/1.jpg",
          mediaType: "image",
        }),
      })
    );
  });

  it("triggers moderation scan for image uploads", async () => {
    setupAuth();
    setupRoom();
    setupNotMuted();
    (mockPrisma.chatRoomMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      roomId: ROOM.id,
      senderId: "u1",
      content: "",
      mediaUrl: "https://img.com/photo.jpg",
      mediaType: "image",
      mediaFileName: "photo.jpg",
      mediaFileSize: 1000,
      isNsfw: false,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: SENDER,
      replyTo: null,
      reactions: [],
    });

    await sendChatRoomMessage("", "lobby", {
      mediaUrl: "https://img.com/photo.jpg",
      mediaType: "image",
      mediaFileName: "photo.jpg",
      mediaFileSize: 1000,
    });
    expect(inngest.send).toHaveBeenCalledWith({
      name: "moderation/scan-chatroom-message",
      data: { messageId: "msg1", senderId: "u1", roomSlug: "lobby" },
    });
  });

  it("does not trigger moderation scan for non-image uploads", async () => {
    setupAuth();
    setupRoom();
    setupNotMuted();
    (mockPrisma.chatRoomMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      roomId: ROOM.id,
      senderId: "u1",
      content: "check this doc",
      mediaUrl: "https://files.com/doc.pdf",
      mediaType: "document",
      mediaFileName: "doc.pdf",
      mediaFileSize: 5000,
      isNsfw: false,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: SENDER,
      replyTo: null,
      reactions: [],
    });

    await sendChatRoomMessage("check this doc", "lobby", {
      mediaUrl: "https://files.com/doc.pdf",
      mediaType: "document",
      mediaFileName: "doc.pdf",
      mediaFileSize: 5000,
    });
    expect(inngest.send).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// editChatRoomMessage
// ---------------------------------------------------------------------------
describe("editChatRoomMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    setupNoAuth();
    const result = await editChatRoomMessage("msg1", "new content");
    expect(result.success).toBe(false);
  });

  it("returns error for empty content", async () => {
    setupAuth();
    const result = await editChatRoomMessage("msg1", "   ");
    expect(result.success).toBe(false);
    expect(result.message).toContain("cannot be empty");
  });

  it("returns error when message not found", async () => {
    setupAuth();
    (mockPrisma.chatRoomMessage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await editChatRoomMessage("msg1", "new content");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("returns error when editing someone else's message", async () => {
    setupAuth();
    (mockPrisma.chatRoomMessage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      senderId: "u2",
      roomId: ROOM.id,
      deletedAt: null,
      room: { slug: "lobby" },
    });
    const result = await editChatRoomMessage("msg1", "new content");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not yours");
  });

  it("returns error when editing a deleted message", async () => {
    setupAuth();
    (mockPrisma.chatRoomMessage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      senderId: "u1",
      roomId: ROOM.id,
      deletedAt: new Date(),
      room: { slug: "lobby" },
    });
    const result = await editChatRoomMessage("msg1", "new content");
    expect(result.success).toBe(false);
    expect(result.message).toContain("deleted");
  });

  it("edits message successfully", async () => {
    setupAuth();
    (mockPrisma.chatRoomMessage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      senderId: "u1",
      roomId: ROOM.id,
      deletedAt: null,
      room: { slug: "lobby" },
    });
    (mockPrisma.chatRoomMessage.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      content: "updated",
      editedAt: new Date(),
    });

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
    setupNoAuth();
    const result = await deleteChatRoomMessage("msg1");
    expect(result.success).toBe(false);
  });

  it("returns error when message not found", async () => {
    setupAuth();
    (mockPrisma.chatRoomMessage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await deleteChatRoomMessage("msg1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("returns error when deleting someone else's message as non-mod", async () => {
    setupAuth();
    (mockPrisma.chatRoomMessage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      senderId: "u2",
      room: { id: ROOM.id, slug: "lobby" },
    });
    (mockPrisma.chatRoom.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ownerId: "owner1" });
    (mockPrisma.chatRoomModerator.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await deleteChatRoomMessage("msg1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Not authorized");
  });

  it("soft-deletes own message successfully", async () => {
    setupAuth();
    (mockPrisma.chatRoomMessage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      senderId: "u1",
      room: { id: ROOM.id, slug: "lobby" },
    });
    (mockPrisma.chatRoom.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ownerId: "owner1" });
    (mockPrisma.chatRoomModerator.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.chatRoomMessage.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await deleteChatRoomMessage("msg1");
    expect(result.success).toBe(true);
    expect(mockPrisma.chatRoomMessage.update).toHaveBeenCalledWith({
      where: { id: "msg1" },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("allows moderator to delete other's message", async () => {
    setupAuth();
    (mockPrisma.chatRoomMessage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      senderId: "u2",
      room: { id: ROOM.id, slug: "lobby" },
    });
    (mockPrisma.chatRoom.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ownerId: "owner1" });
    (mockPrisma.chatRoomModerator.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "mod1" });
    (mockPrisma.chatRoomMessage.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await deleteChatRoomMessage("msg1");
    expect(result.success).toBe(true);
  });

  it("allows room owner to delete any message", async () => {
    setupAuth("owner1");
    (mockPrisma.chatRoomMessage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      senderId: "u2",
      room: { id: ROOM.id, slug: "lobby" },
    });
    (mockPrisma.chatRoom.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ownerId: "owner1" });
    (mockPrisma.chatRoomMessage.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await deleteChatRoomMessage("msg1");
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getChatRoomMessages
// ---------------------------------------------------------------------------
describe("getChatRoomMessages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty when not authenticated", async () => {
    setupNoAuth();
    const result = await getChatRoomMessages("lobby");
    expect(result).toEqual({ messages: [], nextCursor: null });
  });

  it("returns messages in chronological order", async () => {
    setupAuth();
    setupRoom();
    const mockMessages = [
      { id: "msg2", createdAt: new Date("2026-01-02"), senderId: "u1", roomId: ROOM.id, content: "b", mediaUrl: null, mediaType: null, mediaFileName: null, mediaFileSize: null, editedAt: null, deletedAt: null, sender: SENDER, replyTo: null, reactions: [] },
      { id: "msg1", createdAt: new Date("2026-01-01"), senderId: "u1", roomId: ROOM.id, content: "a", mediaUrl: null, mediaType: null, mediaFileName: null, mediaFileSize: null, editedAt: null, deletedAt: null, sender: SENDER, replyTo: null, reactions: [] },
    ];
    (mockPrisma.chatRoomMessage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockMessages);

    const result = await getChatRoomMessages("lobby");
    expect(result.messages[0].id).toBe("msg1");
    expect(result.messages[1].id).toBe("msg2");
    expect(result.nextCursor).toBeNull();
  });

  it("returns cursor when more messages exist", async () => {
    setupAuth();
    setupRoom();
    const mockMessages = Array.from({ length: 41 }, (_, i) => ({
      id: `msg${i}`,
      createdAt: new Date(`2026-01-${String(i + 1).padStart(2, "0")}`),
      senderId: "u1",
      roomId: ROOM.id,
      content: `msg ${i}`,
      mediaUrl: null,
      mediaType: null,
      mediaFileName: null,
      mediaFileSize: null,
      editedAt: null,
      deletedAt: null,
      sender: SENDER,
      replyTo: null,
      reactions: [],
    }));
    (mockPrisma.chatRoomMessage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockMessages);

    const result = await getChatRoomMessages("lobby");
    expect(result.messages).toHaveLength(40);
    expect(result.nextCursor).not.toBeNull();
  });

  it("groups reactions by emoji", async () => {
    setupAuth();
    setupRoom();
    const mockMessages = [
      {
        id: "msg1",
        createdAt: new Date("2026-01-01"),
        senderId: "u1",
        roomId: ROOM.id,
        content: "hello",
        mediaUrl: null,
        mediaType: null,
        mediaFileName: null,
        mediaFileSize: null,
        editedAt: null,
        deletedAt: null,
        sender: SENDER,
        replyTo: null,
        reactions: [
          { emoji: "👍", userId: "u1" },
          { emoji: "👍", userId: "u2" },
          { emoji: "❤️", userId: "u3" },
        ],
      },
    ];
    (mockPrisma.chatRoomMessage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockMessages);

    const result = await getChatRoomMessages("lobby");
    expect(result.messages[0].reactions).toEqual([
      { emoji: "👍", userIds: ["u1", "u2"] },
      { emoji: "❤️", userIds: ["u3"] },
    ]);
  });
});

// ---------------------------------------------------------------------------
// toggleReaction
// ---------------------------------------------------------------------------
describe("toggleReaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds reaction when not existing", async () => {
    setupAuth();
    (mockPrisma.chatRoomMessage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      deletedAt: null,
      room: { slug: "lobby" },
    });
    (mockPrisma.chatRoomMessageReaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.chatRoomMessageReaction.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (mockPrisma.chatRoomMessageReaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { emoji: "👍", userId: "u1" },
    ]);

    const result = await toggleReaction("msg1", "👍");
    expect(result.success).toBe(true);
    expect(result.message).toContain("added");
    expect(mockPrisma.chatRoomMessageReaction.create).toHaveBeenCalled();
  });

  it("removes reaction when already existing", async () => {
    setupAuth();
    (mockPrisma.chatRoomMessage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      deletedAt: null,
      room: { slug: "lobby" },
    });
    (mockPrisma.chatRoomMessageReaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "r1",
    });
    (mockPrisma.chatRoomMessageReaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await toggleReaction("msg1", "👍");
    expect(result.success).toBe(true);
    expect(result.message).toContain("removed");
    expect(mockPrisma.chatRoomMessageReaction.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
  });

  it("returns error for deleted message", async () => {
    setupAuth();
    (mockPrisma.chatRoomMessage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg1",
      deletedAt: new Date(),
      room: { slug: "lobby" },
    });

    const result = await toggleReaction("msg1", "👍");
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Moderator management
// ---------------------------------------------------------------------------
describe("addModerator / removeModerator", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only room owner can add moderator", async () => {
    setupAuth("u1"); // not the owner
    setupRoom();
    const result = await addModerator("lobby", "u2");
    expect(result.success).toBe(false);
    expect(result.message).toContain("owner");
  });

  it("room owner can add moderator", async () => {
    setupAuth("owner1");
    setupRoom();
    (mockPrisma.chatRoomModerator.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await addModerator("lobby", "u2");
    expect(result.success).toBe(true);
  });

  it("room owner can remove moderator", async () => {
    setupAuth("owner1");
    setupRoom();
    (mockPrisma.chatRoomModerator.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const result = await removeModerator("lobby", "u2");
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Mute / Unmute
// ---------------------------------------------------------------------------
describe("muteUser / unmuteUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("non-mod cannot mute", async () => {
    setupAuth("u1");
    setupRoom();
    (mockPrisma.chatRoom.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ownerId: "owner1" });
    (mockPrisma.chatRoomModerator.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await muteUser("lobby", "u2");
    expect(result.success).toBe(false);
  });

  it("moderator can mute with duration", async () => {
    setupAuth("u1");
    setupRoom();
    (mockPrisma.chatRoom.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ownerId: "owner1" });
    (mockPrisma.chatRoomModerator.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "mod1" });
    (mockPrisma.chatRoomMute.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await muteUser("lobby", "u2", 60);
    expect(result.success).toBe(true);
    expect(mockPrisma.chatRoomMute.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      })
    );
  });

  it("owner can unmute", async () => {
    setupAuth("owner1");
    setupRoom();
    (mockPrisma.chatRoom.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ownerId: "owner1" });
    (mockPrisma.chatRoomMute.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const result = await unmuteUser("lobby", "u2");
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// setChatRoomStatus
// ---------------------------------------------------------------------------
describe("setChatRoomStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("non-mod cannot set status", async () => {
    setupAuth("u1");
    setupRoom();
    (mockPrisma.chatRoom.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ownerId: "owner1" });
    (mockPrisma.chatRoomModerator.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await setChatRoomStatus("lobby", "new status");
    expect(result.success).toBe(false);
  });

  it("owner can set status", async () => {
    setupAuth("owner1");
    setupRoom();
    (mockPrisma.chatRoom.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ownerId: "owner1" });
    (mockPrisma.chatRoom.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await setChatRoomStatus("lobby", "Welcome everyone!");
    expect(result.success).toBe(true);
  });

  it("clears status when empty string", async () => {
    setupAuth("owner1");
    setupRoom();
    (mockPrisma.chatRoom.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ownerId: "owner1" });
    (mockPrisma.chatRoom.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await setChatRoomStatus("lobby", "   ");
    expect(mockPrisma.chatRoom.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: null },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// searchChatRoomUsers
// ---------------------------------------------------------------------------
describe("searchChatRoomUsers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty when not authenticated", async () => {
    setupNoAuth();
    const result = await searchChatRoomUsers("al");
    expect(result).toEqual([]);
  });

  it("returns matching users", async () => {
    setupAuth();
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([SENDER]);

    const result = await searchChatRoomUsers("al");
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("alice");
  });

  it("returns empty for empty query", async () => {
    setupAuth();
    const result = await searchChatRoomUsers("  ");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getChatRoomMeta
// ---------------------------------------------------------------------------
describe("getChatRoomMeta", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns room metadata", async () => {
    setupRoom();
    (mockPrisma.chatRoomModerator.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { userId: "mod1" },
      { userId: "mod2" },
    ]);
    (mockPrisma.chatRoomMute.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { userId: "muted1", expiresAt: null },
    ]);

    const result = await getChatRoomMeta("lobby");
    expect(result.slug).toBe("lobby");
    expect(result.ownerId).toBe("owner1");
    expect(result.moderatorIds).toEqual(["mod1", "mod2"]);
    expect(result.mutes).toEqual([{ userId: "muted1", expiresAt: null }]);
  });
});
