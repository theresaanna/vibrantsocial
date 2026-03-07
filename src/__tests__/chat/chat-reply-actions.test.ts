import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMessage, getMessages } from "@/app/chat/actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/phone-gate", () => ({
  requirePhoneVerification: vi.fn(),
}));

const mockAblyPublish = vi.fn();
vi.mock("@/lib/ably", () => ({
  getAblyRestClient: () => ({
    channels: {
      get: () => ({ publish: mockAblyPublish }),
    },
  }),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendNewChatEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversation: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    conversationParticipant: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    message: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    messageReaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    messageRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    follow: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { send: vi.fn() },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockPhoneGate = vi.mocked(requirePhoneVerification);

describe("sendMessage with replyToId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates reply belongs to same conversation", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    // Reply target is in a different conversation
    mockPrisma.message.findUnique.mockResolvedValueOnce({
      id: "reply-target",
      conversationId: "other-conv",
      content: "Original",
      senderId: "user2",
      deletedAt: null,
      mediaType: null,
      sender: { displayName: "Alice", username: "alice", name: "Alice" },
    } as never);

    const result = await sendMessage({
      conversationId: "conv1",
      content: "replying",
      replyToId: "reply-target",
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Reply target not found in this conversation");
  });

  it("rejects if reply target not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    // Reply target does not exist
    mockPrisma.message.findUnique.mockResolvedValueOnce(null as never);

    const result = await sendMessage({
      conversationId: "conv1",
      content: "replying",
      replyToId: "nonexistent-msg",
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Reply target not found in this conversation");
  });

  it("includes replyTo data in Ably publish", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    // Reply target found in the same conversation
    mockPrisma.message.findUnique.mockResolvedValueOnce({
      id: "reply-target",
      conversationId: "conv1",
      content: "Original message",
      senderId: "user2",
      deletedAt: null,
      mediaType: null,
      sender: { displayName: "Alice", username: "alice", name: "Alice" },
    } as never);
    mockPrisma.message.create.mockResolvedValueOnce({
      id: "new-msg",
      conversationId: "conv1",
      senderId: "user1",
      content: "replying",
      mediaUrl: null,
      mediaType: null,
      mediaFileName: null,
      mediaFileSize: null,
      createdAt: new Date("2024-01-01T12:00:00Z"),
      sender: {
        id: "user1",
        username: "me",
        displayName: "Me",
        name: "Me",
        avatar: null,
        image: null,
      },
    } as never);
    mockPrisma.conversation.update.mockResolvedValueOnce({} as never);
    mockPrisma.conversationParticipant.update.mockResolvedValueOnce({} as never);

    const result = await sendMessage({
      conversationId: "conv1",
      content: "replying",
      replyToId: "reply-target",
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("new-msg");

    // Check Ably publish was called with replyTo data
    expect(mockAblyPublish).toHaveBeenCalledWith(
      "new",
      expect.objectContaining({
        id: "new-msg",
        conversationId: "conv1",
        replyTo: expect.any(String),
      })
    );

    // Verify the replyTo JSON payload
    const publishCall = mockAblyPublish.mock.calls[0][1];
    const replyToData = JSON.parse(publishCall.replyTo);
    expect(replyToData.id).toBe("reply-target");
    expect(replyToData.content).toBe("Original message");
    expect(replyToData.senderName).toBe("Alice");
    expect(replyToData.senderId).toBe("user2");
  });

  it("sends message without replyToId works as before (replyTo is null)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    mockPrisma.message.create.mockResolvedValueOnce({
      id: "msg1",
      conversationId: "conv1",
      senderId: "user1",
      content: "hello",
      mediaUrl: null,
      mediaType: null,
      mediaFileName: null,
      mediaFileSize: null,
      createdAt: new Date("2024-01-01T12:00:00Z"),
      sender: {
        id: "user1",
        username: "me",
        displayName: "Me",
        name: "Me",
        avatar: null,
        image: null,
      },
    } as never);
    mockPrisma.conversation.update.mockResolvedValueOnce({} as never);
    mockPrisma.conversationParticipant.update.mockResolvedValueOnce({} as never);

    const result = await sendMessage({
      conversationId: "conv1",
      content: "hello",
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg1");

    // message.findUnique should NOT have been called (no replyToId)
    expect(mockPrisma.message.findUnique).not.toHaveBeenCalled();

    // Ably publish should have replyTo: null
    expect(mockAblyPublish).toHaveBeenCalledWith(
      "new",
      expect.objectContaining({
        replyTo: null,
      })
    );
  });
});

describe("getMessages includes replyTo data", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes replyTo data in returned messages", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    mockPrisma.message.findMany.mockResolvedValueOnce([
      {
        id: "m2",
        conversationId: "conv1",
        senderId: "user2",
        content: "This is a reply",
        mediaUrl: null,
        mediaType: null,
        mediaFileName: null,
        mediaFileSize: null,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date("2024-01-01T11:00:00Z"),
        sender: {
          id: "user2",
          username: "alice",
          displayName: "Alice",
          name: "Alice",
          avatar: null,
          image: null,
        },
        reactions: [],
        replyTo: {
          id: "m1",
          content: "Original message",
          senderId: "user1",
          deletedAt: null,
          mediaType: null,
          sender: { displayName: "Me", username: "me", name: "Me" },
        },
      },
      {
        id: "m1",
        conversationId: "conv1",
        senderId: "user1",
        content: "Original message",
        mediaUrl: null,
        mediaType: null,
        mediaFileName: null,
        mediaFileSize: null,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date("2024-01-01T10:00:00Z"),
        sender: {
          id: "user1",
          username: "me",
          displayName: "Me",
          name: "Me",
          avatar: null,
          image: null,
        },
        reactions: [],
        replyTo: null,
      },
    ] as never);

    const result = await getMessages("conv1");
    expect(result.messages).toHaveLength(2);

    // First message (chronological) has no reply
    expect(result.messages[0].id).toBe("m1");
    expect(result.messages[0].replyTo).toBeNull();

    // Second message has replyTo data
    expect(result.messages[1].id).toBe("m2");
    expect(result.messages[1].replyTo).not.toBeNull();
    expect(result.messages[1].replyTo!.id).toBe("m1");
    expect(result.messages[1].replyTo!.content).toBe("Original message");
    expect(result.messages[1].replyTo!.senderName).toBe("Me");
    expect(result.messages[1].replyTo!.senderId).toBe("user1");
  });
});
