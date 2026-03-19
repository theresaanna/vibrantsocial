import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getConversations,
  getMessages,
  getMessageRequests,
  startConversation,
  createGroupConversation,
  sendMessage,
  editMessage,
  deleteMessage,
  markConversationRead,
  acceptMessageRequest,
  declineMessageRequest,
  bulkDeclineMessageRequests,
  searchUsers,
  toggleReaction,
} from "@/app/chat/actions";

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

const mockCreateNotification = vi.fn();
vi.mock("@/lib/notifications", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
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
    friendRequest: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockPhoneGate = vi.mocked(requirePhoneVerification);

describe("startConversation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await startConversation("target-id");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if phone not verified", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(false);
    const result = await startConversation("user2");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Phone verification required to start conversations");
  });

  it("prevents messaging yourself", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    const result = await startConversation("user1");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Cannot message yourself");
  });

  it("returns error if target user not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    const result = await startConversation("nonexistent");
    expect(result.success).toBe(false);
    expect(result.message).toBe("User not found");
  });

  it("returns existing conversation if found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user2" } as never);
    mockPrisma.conversation.findFirst.mockResolvedValueOnce({
      id: "conv1",
    } as never);

    const result = await startConversation("user2");
    expect(result.success).toBe(true);
    expect(result.conversationId).toBe("conv1");
  });

  it("creates conversation for mutual followers", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user2" } as never);
    mockPrisma.conversation.findFirst.mockResolvedValueOnce(null as never);
    // Friendship check via friendRequest
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce({ id: "f1" } as never);
    mockPrisma.conversation.create.mockResolvedValueOnce({
      id: "new-conv",
    } as never);

    const result = await startConversation("user2");
    expect(result.success).toBe(true);
    expect(result.conversationId).toBe("new-conv");
    expect(mockPrisma.conversation.create).toHaveBeenCalled();
  });

  it("creates message request for non-friends", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user2" } as never);
    mockPrisma.conversation.findFirst.mockResolvedValueOnce(null as never);
    // Not friends
    mockPrisma.friendRequest.findFirst.mockResolvedValueOnce(null as never);
    mockPrisma.messageRequest.upsert.mockResolvedValueOnce({} as never);

    const result = await startConversation("user2");
    expect(result.success).toBe(true);
    expect(result.message).toBe("Message request sent");
    expect(result.conversationId).toBeUndefined();
  });
});

describe("createGroupConversation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await createGroupConversation({
      name: "Test",
      participantIds: ["a", "b"],
    });
    expect(result.success).toBe(false);
  });

  it("returns error if phone not verified", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(false);
    const result = await createGroupConversation({
      name: "Test",
      participantIds: ["a", "b"],
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Phone verification required to create groups");
  });

  it("rejects empty name", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    const result = await createGroupConversation({
      name: "  ",
      participantIds: ["a", "b"],
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Group name is required");
  });

  it("rejects name over 100 characters", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    const result = await createGroupConversation({
      name: "a".repeat(101),
      participantIds: ["a", "b"],
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Group name too long (max 100 characters)");
  });

  it("rejects fewer than 2 other participants", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    const result = await createGroupConversation({
      name: "Test",
      participantIds: ["a"],
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Groups need at least 2 other members");
  });

  it("rejects if some users not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.user.findMany.mockResolvedValueOnce([{ id: "a" }] as never);

    const result = await createGroupConversation({
      name: "Test",
      participantIds: ["a", "b"],
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Some users were not found");
  });

  it("creates group successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: "a" },
      { id: "b" },
    ] as never);
    mockPrisma.conversation.create.mockResolvedValueOnce({
      id: "group1",
    } as never);

    const result = await createGroupConversation({
      name: "Test Group",
      participantIds: ["a", "b"],
    });
    expect(result.success).toBe(true);
    expect(result.conversationId).toBe("group1");
  });
});

describe("sendMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await sendMessage({
      conversationId: "conv1",
      content: "hello",
    });
    expect(result.success).toBe(false);
  });

  it("returns error if phone not verified", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(false);
    const result = await sendMessage({
      conversationId: "conv1",
      content: "hello",
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Phone verification required to send messages");
  });

  it("rejects empty content", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    const result = await sendMessage({
      conversationId: "conv1",
      content: "   ",
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Message cannot be empty");
  });

  it("rejects content over 5000 characters", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    const result = await sendMessage({
      conversationId: "conv1",
      content: "a".repeat(5001),
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Message too long (max 5000 characters)");
  });

  it("rejects if not a participant", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce(
      null as never
    );
    const result = await sendMessage({
      conversationId: "conv1",
      content: "hello",
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not a participant of this conversation");
  });

  it("sends message successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    mockPrisma.message.create.mockResolvedValueOnce({
      id: "msg1",
    } as never);
    mockPrisma.conversation.update.mockResolvedValueOnce({} as never);
    mockPrisma.conversationParticipant.update.mockResolvedValueOnce(
      {} as never
    );

    const result = await sendMessage({
      conversationId: "conv1",
      content: "hello",
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg1");
    expect(mockPrisma.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: "conv1",
        senderId: "user1",
        content: "hello",
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            name: true,
            avatar: true,
            image: true,
            profileFrameId: true,
            usernameFont: true,
          },
        },
      },
    });
  });

  it("sends message with media attachment successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    mockPrisma.message.create.mockResolvedValueOnce({
      id: "msg2",
    } as never);
    mockPrisma.conversation.update.mockResolvedValueOnce({} as never);
    mockPrisma.conversationParticipant.update.mockResolvedValueOnce(
      {} as never
    );

    const result = await sendMessage({
      conversationId: "conv1",
      content: "check this out",
      mediaUrl: "https://example.com/photo.jpg",
      mediaType: "image",
      mediaFileName: "photo.jpg",
      mediaFileSize: 500000,
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg2");
    expect(mockPrisma.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: "conv1",
        senderId: "user1",
        content: "check this out",
        mediaUrl: "https://example.com/photo.jpg",
        mediaType: "image",
        mediaFileName: "photo.jpg",
        mediaFileSize: 500000,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            name: true,
            avatar: true,
            image: true,
            profileFrameId: true,
            usernameFont: true,
          },
        },
      },
    });
  });

  it("allows empty content when media is present", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    mockPrisma.message.create.mockResolvedValueOnce({
      id: "msg3",
    } as never);
    mockPrisma.conversation.update.mockResolvedValueOnce({} as never);
    mockPrisma.conversationParticipant.update.mockResolvedValueOnce(
      {} as never
    );

    const result = await sendMessage({
      conversationId: "conv1",
      content: "",
      mediaUrl: "https://example.com/photo.jpg",
      mediaType: "image",
      mediaFileName: "photo.jpg",
      mediaFileSize: 500000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content and no media", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);

    const result = await sendMessage({
      conversationId: "conv1",
      content: "",
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Message cannot be empty");
  });

  it("rejects invalid mediaType", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);

    const result = await sendMessage({
      conversationId: "conv1",
      content: "hello",
      mediaUrl: "https://example.com/malware.exe",
      mediaType: "exe",
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid media type");
  });
});

describe("editMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await editMessage({
      messageId: "msg1",
      content: "edited",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty content", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await editMessage({ messageId: "msg1", content: "  " });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Message cannot be empty");
  });

  it("returns error if message not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.message.findUnique.mockResolvedValueOnce(null as never);
    const result = await editMessage({
      messageId: "msg1",
      content: "edited",
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Message not found");
  });

  it("rejects editing another user's message", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.message.findUnique.mockResolvedValueOnce({
      id: "msg1",
      senderId: "user2",
      deletedAt: null,
    } as never);
    const result = await editMessage({
      messageId: "msg1",
      content: "edited",
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Can only edit your own messages");
  });

  it("rejects editing a deleted message", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.message.findUnique.mockResolvedValueOnce({
      id: "msg1",
      senderId: "user1",
      deletedAt: new Date(),
    } as never);
    const result = await editMessage({
      messageId: "msg1",
      content: "edited",
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Cannot edit a deleted message");
  });

  it("edits message successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.message.findUnique.mockResolvedValueOnce({
      id: "msg1",
      senderId: "user1",
      deletedAt: null,
    } as never);
    mockPrisma.message.update.mockResolvedValueOnce({} as never);

    const result = await editMessage({
      messageId: "msg1",
      content: "edited content",
    });
    expect(result.success).toBe(true);
    expect(result.message).toBe("Message edited");
  });
});

describe("deleteMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await deleteMessage("msg1");
    expect(result.success).toBe(false);
  });

  it("returns error if message not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.message.findUnique.mockResolvedValueOnce(null as never);
    const result = await deleteMessage("msg1");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Message not found");
  });

  it("rejects deleting another user's message", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.message.findUnique.mockResolvedValueOnce({
      id: "msg1",
      senderId: "user2",
    } as never);
    const result = await deleteMessage("msg1");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Can only delete your own messages");
  });

  it("soft-deletes message successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.message.findUnique.mockResolvedValueOnce({
      id: "msg1",
      senderId: "user1",
    } as never);
    mockPrisma.message.update.mockResolvedValueOnce({} as never);

    const result = await deleteMessage("msg1");
    expect(result.success).toBe(true);
    expect(result.message).toBe("Message deleted");
  });
});

describe("markConversationRead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await markConversationRead("conv1");
    expect(result.success).toBe(false);
  });

  it("returns error if not a participant", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce(
      null as never
    );
    const result = await markConversationRead("conv1");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not a participant of this conversation");
  });

  it("marks as read successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    mockPrisma.conversationParticipant.update.mockResolvedValueOnce(
      {} as never
    );

    const result = await markConversationRead("conv1");
    expect(result.success).toBe(true);
    expect(result.message).toBe("Marked as read");
  });

  it("publishes read event to Ably after updating DB", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    mockPrisma.conversationParticipant.update.mockResolvedValueOnce(
      {} as never
    );

    await markConversationRead("conv1");
    expect(mockAblyPublish).toHaveBeenCalledWith(
      "read",
      expect.objectContaining({
        userId: "user1",
        timestamp: expect.any(String),
      })
    );
  });

  it("succeeds even if Ably publish fails", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    mockPrisma.conversationParticipant.update.mockResolvedValueOnce(
      {} as never
    );
    mockAblyPublish.mockRejectedValueOnce(new Error("Ably error"));

    const result = await markConversationRead("conv1");
    expect(result.success).toBe(true);
  });
});

describe("acceptMessageRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await acceptMessageRequest("req1");
    expect(result.success).toBe(false);
  });

  it("returns error if request not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.messageRequest.findUnique.mockResolvedValueOnce(null as never);
    const result = await acceptMessageRequest("req1");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Request not found");
  });

  it("rejects if not the receiver", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.messageRequest.findUnique.mockResolvedValueOnce({
      id: "req1",
      receiverId: "user2",
      status: "PENDING",
    } as never);
    const result = await acceptMessageRequest("req1");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not your request");
  });

  it("rejects if not PENDING", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.messageRequest.findUnique.mockResolvedValueOnce({
      id: "req1",
      receiverId: "user1",
      senderId: "user2",
      status: "ACCEPTED",
    } as never);
    const result = await acceptMessageRequest("req1");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Request already handled");
  });

  it("accepts request and creates conversation", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.messageRequest.findUnique.mockResolvedValueOnce({
      id: "req1",
      receiverId: "user1",
      senderId: "user2",
      status: "PENDING",
    } as never);
    mockPrisma.messageRequest.update.mockResolvedValueOnce({} as never);
    mockPrisma.conversation.create.mockResolvedValueOnce({
      id: "conv1",
    } as never);

    const result = await acceptMessageRequest("req1");
    expect(result.success).toBe(true);
    expect(result.conversationId).toBe("conv1");
  });
});

describe("declineMessageRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await declineMessageRequest("req1");
    expect(result.success).toBe(false);
  });

  it("returns error if request not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.messageRequest.findUnique.mockResolvedValueOnce(null as never);
    const result = await declineMessageRequest("req1");
    expect(result.success).toBe(false);
  });

  it("rejects if not the receiver", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.messageRequest.findUnique.mockResolvedValueOnce({
      id: "req1",
      receiverId: "user2",
      status: "PENDING",
    } as never);
    const result = await declineMessageRequest("req1");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not your request");
  });

  it("declines request successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.messageRequest.findUnique.mockResolvedValueOnce({
      id: "req1",
      receiverId: "user1",
      status: "PENDING",
    } as never);
    mockPrisma.messageRequest.update.mockResolvedValueOnce({} as never);

    const result = await declineMessageRequest("req1");
    expect(result.success).toBe(true);
    expect(result.message).toBe("Request declined");
  });
});

describe("getConversations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await getConversations();
    expect(result).toEqual([]);
  });

  it("returns conversations with correct structure", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([
      {
        userId: "user1",
        lastReadAt: new Date("2024-01-01T12:00:00Z"),
        conversation: {
          id: "conv1",
          isGroup: false,
          name: null,
          avatarUrl: null,
          participants: [
            { userId: "user1", user: { id: "user1", username: "me", displayName: "Me", name: "Me", avatar: null, image: null } },
            { userId: "user2", user: { id: "user2", username: "alice", displayName: "Alice", name: "Alice", avatar: null, image: null } },
          ],
          messages: [{ content: "hello", senderId: "user2", createdAt: new Date("2024-01-01T11:00:00Z"), deletedAt: null }],
        },
      },
    ] as never);

    const result = await getConversations();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("conv1");
    expect(result[0].participants).toHaveLength(1);
    expect(result[0].participants[0].id).toBe("user2");
    expect(result[0].lastMessage?.content).toBe("hello");
  });

  it("calculates unread count as 1 when lastReadAt is null", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([
      {
        userId: "user1",
        lastReadAt: null,
        conversation: {
          id: "conv1",
          isGroup: false,
          name: null,
          avatarUrl: null,
          participants: [
            { userId: "user1", user: { id: "user1", username: "me", displayName: "Me", name: "Me", avatar: null, image: null } },
          ],
          messages: [{ content: "hi", senderId: "user2", createdAt: new Date(), deletedAt: null }],
        },
      },
    ] as never);

    const result = await getConversations();
    expect(result[0].unreadCount).toBe(1);
  });

  it("calculates unread count as 0 when lastReadAt is after last message", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([
      {
        userId: "user1",
        lastReadAt: new Date("2024-01-02T00:00:00Z"),
        conversation: {
          id: "conv1",
          isGroup: false,
          name: null,
          avatarUrl: null,
          participants: [
            { userId: "user1", user: { id: "user1", username: "me", displayName: "Me", name: "Me", avatar: null, image: null } },
          ],
          messages: [{ content: "hi", senderId: "user2", createdAt: new Date("2024-01-01T10:00:00Z"), deletedAt: null }],
        },
      },
    ] as never);

    const result = await getConversations();
    expect(result[0].unreadCount).toBe(0);
  });

  it("returns 0 unread when no messages", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([
      {
        userId: "user1",
        lastReadAt: null,
        conversation: {
          id: "conv1",
          isGroup: false,
          name: null,
          avatarUrl: null,
          participants: [
            { userId: "user1", user: { id: "user1", username: "me", displayName: "Me", name: "Me", avatar: null, image: null } },
          ],
          messages: [],
        },
      },
    ] as never);

    const result = await getConversations();
    expect(result[0].unreadCount).toBe(0);
  });
});

describe("getMessages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await getMessages("conv1");
    expect(result.messages).toEqual([]);
  });

  it("returns empty if not a participant", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce(
      null as never
    );
    const result = await getMessages("conv1");
    expect(result.messages).toEqual([]);
  });

  it("returns messages in chronological order", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({ id: "p1" } as never);
    // DB returns in desc order (newest first)
    mockPrisma.message.findMany.mockResolvedValueOnce([
      { id: "m2", content: "second", createdAt: new Date("2024-01-01T11:00:00Z"), sender: {}, reactions: [] },
      { id: "m1", content: "first", createdAt: new Date("2024-01-01T10:00:00Z"), sender: {}, reactions: [] },
    ] as never);

    const result = await getMessages("conv1");
    // Should be reversed to chronological (oldest first)
    expect(result.messages[0].id).toBe("m1");
    expect(result.messages[1].id).toBe("m2");
    expect(result.nextCursor).toBeNull();
  });

  it("returns pagination cursor when more than 50 messages", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({ id: "p1" } as never);
    // 51 messages means there are more
    const messages = Array.from({ length: 51 }, (_, i) => ({
      id: `m${i}`,
      content: `msg ${i}`,
      createdAt: new Date(`2024-01-01T${String(i).padStart(2, "0")}:00:00Z`),
      sender: {},
      reactions: [],
    }));
    mockPrisma.message.findMany.mockResolvedValueOnce(messages as never);

    const result = await getMessages("conv1");
    expect(result.messages).toHaveLength(50);
    expect(result.nextCursor).toBeTruthy();
  });

  it("passes cursor to query when provided", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({ id: "p1" } as never);
    mockPrisma.message.findMany.mockResolvedValueOnce([] as never);

    await getMessages("conv1", "cursor-id");
    expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "cursor-id" },
        skip: 1,
      })
    );
  });
});

describe("getMessageRequests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await getMessageRequests();
    expect(result).toEqual([]);
  });
});

describe("bulkDeclineMessageRequests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await bulkDeclineMessageRequests(["req1"]);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if no request IDs provided", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await bulkDeclineMessageRequests([]);
    expect(result.success).toBe(false);
    expect(result.message).toBe("No requests selected");
  });

  it("returns error if some requests not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.messageRequest.findMany.mockResolvedValueOnce([
      { id: "req1", receiverId: "user1", status: "PENDING" },
    ] as never);

    const result = await bulkDeclineMessageRequests(["req1", "req2"]);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Some requests not found");
  });

  it("returns error if some requests belong to another user", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.messageRequest.findMany.mockResolvedValueOnce([
      { id: "req1", receiverId: "user1", status: "PENDING" },
      { id: "req2", receiverId: "user2", status: "PENDING" },
    ] as never);

    const result = await bulkDeclineMessageRequests(["req1", "req2"]);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Some requests are invalid");
  });

  it("returns error if some requests are not PENDING", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.messageRequest.findMany.mockResolvedValueOnce([
      { id: "req1", receiverId: "user1", status: "PENDING" },
      { id: "req2", receiverId: "user1", status: "ACCEPTED" },
    ] as never);

    const result = await bulkDeclineMessageRequests(["req1", "req2"]);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Some requests are invalid");
  });

  it("declines multiple requests successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.messageRequest.findMany.mockResolvedValueOnce([
      { id: "req1", receiverId: "user1", status: "PENDING" },
      { id: "req2", receiverId: "user1", status: "PENDING" },
    ] as never);
    mockPrisma.messageRequest.updateMany.mockResolvedValueOnce({ count: 2 } as never);

    const result = await bulkDeclineMessageRequests(["req1", "req2"]);
    expect(result.success).toBe(true);
    expect(result.message).toBe("2 request(s) declined");
    expect(mockPrisma.messageRequest.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["req1", "req2"] }, receiverId: "user1", status: "PENDING" },
      data: { status: "DECLINED" },
    });
  });
});

describe("searchUsers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await searchUsers("test");
    expect(result).toEqual([]);
  });

  it("returns empty for short queries", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await searchUsers("a");
    expect(result).toEqual([]);
  });
});

describe("toggleReaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await toggleReaction({ messageId: "msg1", emoji: "\u{1F44D}" });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if message not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.message.findUnique.mockResolvedValueOnce(null as never);
    const result = await toggleReaction({ messageId: "msg1", emoji: "\u{1F44D}" });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Message not found");
  });

  it("creates notification when reacting to another user's message", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.message.findUnique.mockResolvedValueOnce({
      id: "msg1",
      senderId: "user2",
      conversationId: "conv1",
      deletedAt: null,
    } as never);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    // No existing reaction
    mockPrisma.messageReaction.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.messageReaction.create.mockResolvedValueOnce({} as never);
    mockPrisma.messageReaction.findMany.mockResolvedValueOnce([] as never);
    mockCreateNotification.mockResolvedValueOnce(undefined);

    const result = await toggleReaction({ messageId: "msg1", emoji: "\u{1F44D}" });
    expect(result.success).toBe(true);
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "REACTION",
      actorId: "user1",
      targetUserId: "user2",
      messageId: "msg1",
    });
  });

  it("does not create notification when reacting to own message", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.message.findUnique.mockResolvedValueOnce({
      id: "msg1",
      senderId: "user1",
      conversationId: "conv1",
      deletedAt: null,
    } as never);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    mockPrisma.messageReaction.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.messageReaction.create.mockResolvedValueOnce({} as never);
    mockPrisma.messageReaction.findMany.mockResolvedValueOnce([] as never);

    const result = await toggleReaction({ messageId: "msg1", emoji: "\u{1F44D}" });
    expect(result.success).toBe(true);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("does not create notification when removing a reaction", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.message.findUnique.mockResolvedValueOnce({
      id: "msg1",
      senderId: "user2",
      conversationId: "conv1",
      deletedAt: null,
    } as never);
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "p1",
    } as never);
    // Existing reaction (toggle removes it)
    mockPrisma.messageReaction.findUnique.mockResolvedValueOnce({
      id: "reaction1",
    } as never);
    mockPrisma.messageReaction.delete.mockResolvedValueOnce({} as never);
    mockPrisma.messageReaction.findMany.mockResolvedValueOnce([] as never);

    const result = await toggleReaction({ messageId: "msg1", emoji: "\u{1F44D}" });
    expect(result.success).toBe(true);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});
