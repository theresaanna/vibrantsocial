import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: { create: vi.fn(), findUnique: vi.fn() },
    post: { findUnique: vi.fn() },
    conversation: { findUnique: vi.fn(), update: vi.fn() },
    conversationParticipant: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    message: { create: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@/lib/phone-gate", () => ({
  requirePhoneVerification: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

const mockSendCommentEmail = vi.fn();
const mockSendNewChatEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendCommentEmail: (...args: unknown[]) => mockSendCommentEmail(...args),
  sendNewChatEmail: (...args: unknown[]) => mockSendNewChatEmail(...args),
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
import { requirePhoneVerification } from "@/lib/phone-gate";
import { createComment } from "@/app/feed/post-actions";
import { sendMessage } from "@/app/chat/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockPhoneGate = vi.mocked(requirePhoneVerification);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) fd.set(key, value);
  return fd;
}

const prevState = { success: false, message: "" };

describe("comment email notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends email when post author has emailOnComment enabled", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.comment.create.mockResolvedValueOnce({
      id: "c1",
      content: "Great post!",
      parentId: null,
      createdAt: new Date(),
      author: { id: "u1", username: "alice", displayName: "Alice", name: null, image: null, avatar: null },
    } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      authorId: "author1",
      author: { email: "author@example.com", emailOnComment: true },
    } as never);

    await createComment(prevState, makeFormData({ postId: "p1", content: "Great post!" }));

    expect(mockSendCommentEmail).toHaveBeenCalledWith({
      toEmail: "author@example.com",
      commenterName: "Alice",
      postId: "p1",
    });
  });

  it("does not send email when post author has emailOnComment disabled", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.comment.create.mockResolvedValueOnce({
      id: "c1",
      content: "Nice!",
      parentId: null,
      createdAt: new Date(),
      author: { id: "u1", username: "alice", displayName: "Alice", name: null, image: null, avatar: null },
    } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      authorId: "author1",
      author: { email: "author@example.com", emailOnComment: false },
    } as never);

    await createComment(prevState, makeFormData({ postId: "p1", content: "Nice!" }));

    expect(mockSendCommentEmail).not.toHaveBeenCalled();
  });

  it("does not send email when commenter is the post author", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "author1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.comment.create.mockResolvedValueOnce({
      id: "c1",
      content: "My own comment",
      parentId: null,
      createdAt: new Date(),
      author: { id: "author1", username: "bob", displayName: "Bob", name: null, image: null, avatar: null },
    } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      authorId: "author1",
      author: { email: "bob@example.com", emailOnComment: true },
    } as never);

    await createComment(prevState, makeFormData({ postId: "p1", content: "My own comment" }));

    expect(mockSendCommentEmail).not.toHaveBeenCalled();
  });

  it("does not send email when post author has no email", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.comment.create.mockResolvedValueOnce({
      id: "c1",
      content: "Hello!",
      parentId: null,
      createdAt: new Date(),
      author: { id: "u1", username: "alice", displayName: "Alice", name: null, image: null, avatar: null },
    } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      authorId: "author1",
      author: { email: null, emailOnComment: true },
    } as never);

    await createComment(prevState, makeFormData({ postId: "p1", content: "Hello!" }));

    expect(mockSendCommentEmail).not.toHaveBeenCalled();
  });

  it("uses username as fallback when displayName is null", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockPrisma.comment.create.mockResolvedValueOnce({
      id: "c1",
      content: "Hey!",
      parentId: null,
      createdAt: new Date(),
      author: { id: "u1", username: "alice", displayName: null, name: null, image: null, avatar: null },
    } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      authorId: "author1",
      author: { email: "author@example.com", emailOnComment: true },
    } as never);

    await createComment(prevState, makeFormData({ postId: "p1", content: "Hey!" }));

    expect(mockSendCommentEmail).toHaveBeenCalledWith({
      toEmail: "author@example.com",
      commenterName: "alice",
      postId: "p1",
    });
  });
});

describe("chat email notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends email on first message in a 1:1 conversation", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);

    // Verify participant
    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "cp1",
      conversationId: "conv1",
      userId: "u1",
    } as never);

    // Create message
    mockPrisma.message.create.mockResolvedValueOnce({
      id: "m1",
      conversationId: "conv1",
      senderId: "u1",
      content: "Hello!",
      mediaUrl: null,
      mediaType: null,
      mediaFileName: null,
      mediaFileSize: null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: { id: "u1", username: "alice", displayName: "Alice", name: null, avatar: null, image: null },
    } as never);

    // Update conversation timestamp
    mockPrisma.conversation.update.mockResolvedValueOnce({} as never);

    // Mark as read for sender
    mockPrisma.conversationParticipant.update.mockResolvedValueOnce({} as never);

    // Check if conversation is group
    mockPrisma.conversation.findUnique.mockResolvedValueOnce({
      id: "conv1",
      isGroup: false,
    } as never);

    // Count messages (first message)
    mockPrisma.message.count.mockResolvedValueOnce(1 as never);

    // Find other participant
    mockPrisma.conversationParticipant.findFirst.mockResolvedValueOnce({
      userId: "u2",
      user: { email: "bob@example.com", emailOnNewChat: true },
    } as never);

    await sendMessage({ conversationId: "conv1", content: "Hello!" });

    expect(mockSendNewChatEmail).toHaveBeenCalledWith({
      toEmail: "bob@example.com",
      senderName: "Alice",
      conversationId: "conv1",
    });
  });

  it("does not send email for group conversations", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);

    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "cp1",
      conversationId: "group1",
      userId: "u1",
    } as never);

    mockPrisma.message.create.mockResolvedValueOnce({
      id: "m1",
      conversationId: "group1",
      senderId: "u1",
      content: "Hey everyone!",
      mediaUrl: null,
      mediaType: null,
      mediaFileName: null,
      mediaFileSize: null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: { id: "u1", username: "alice", displayName: "Alice", name: null, avatar: null, image: null },
    } as never);

    mockPrisma.conversation.update.mockResolvedValueOnce({} as never);
    mockPrisma.conversationParticipant.update.mockResolvedValueOnce({} as never);

    // isGroup = true
    mockPrisma.conversation.findUnique.mockResolvedValueOnce({
      id: "group1",
      isGroup: true,
    } as never);

    await sendMessage({ conversationId: "group1", content: "Hey everyone!" });

    expect(mockSendNewChatEmail).not.toHaveBeenCalled();
  });

  it("does not send email for subsequent messages", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);

    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "cp1",
      conversationId: "conv1",
      userId: "u1",
    } as never);

    mockPrisma.message.create.mockResolvedValueOnce({
      id: "m2",
      conversationId: "conv1",
      senderId: "u1",
      content: "Follow up",
      mediaUrl: null,
      mediaType: null,
      mediaFileName: null,
      mediaFileSize: null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: { id: "u1", username: "alice", displayName: "Alice", name: null, avatar: null, image: null },
    } as never);

    mockPrisma.conversation.update.mockResolvedValueOnce({} as never);
    mockPrisma.conversationParticipant.update.mockResolvedValueOnce({} as never);

    mockPrisma.conversation.findUnique.mockResolvedValueOnce({
      id: "conv1",
      isGroup: false,
    } as never);

    // More than 1 message means it's not the first
    mockPrisma.message.count.mockResolvedValueOnce(5 as never);

    await sendMessage({ conversationId: "conv1", content: "Follow up" });

    expect(mockSendNewChatEmail).not.toHaveBeenCalled();
  });

  it("does not send email when recipient has emailOnNewChat disabled", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);

    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "cp1",
      conversationId: "conv1",
      userId: "u1",
    } as never);

    mockPrisma.message.create.mockResolvedValueOnce({
      id: "m1",
      conversationId: "conv1",
      senderId: "u1",
      content: "Hi!",
      mediaUrl: null,
      mediaType: null,
      mediaFileName: null,
      mediaFileSize: null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: { id: "u1", username: "alice", displayName: "Alice", name: null, avatar: null, image: null },
    } as never);

    mockPrisma.conversation.update.mockResolvedValueOnce({} as never);
    mockPrisma.conversationParticipant.update.mockResolvedValueOnce({} as never);

    mockPrisma.conversation.findUnique.mockResolvedValueOnce({
      id: "conv1",
      isGroup: false,
    } as never);

    mockPrisma.message.count.mockResolvedValueOnce(1 as never);

    // Recipient has emailOnNewChat: false
    mockPrisma.conversationParticipant.findFirst.mockResolvedValueOnce({
      userId: "u2",
      user: { email: "bob@example.com", emailOnNewChat: false },
    } as never);

    await sendMessage({ conversationId: "conv1", content: "Hi!" });

    expect(mockSendNewChatEmail).not.toHaveBeenCalled();
  });

  it("does not send email when recipient has no email", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);

    mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: "cp1",
      conversationId: "conv1",
      userId: "u1",
    } as never);

    mockPrisma.message.create.mockResolvedValueOnce({
      id: "m1",
      conversationId: "conv1",
      senderId: "u1",
      content: "Hey!",
      mediaUrl: null,
      mediaType: null,
      mediaFileName: null,
      mediaFileSize: null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      sender: { id: "u1", username: "alice", displayName: "Alice", name: null, avatar: null, image: null },
    } as never);

    mockPrisma.conversation.update.mockResolvedValueOnce({} as never);
    mockPrisma.conversationParticipant.update.mockResolvedValueOnce({} as never);

    mockPrisma.conversation.findUnique.mockResolvedValueOnce({
      id: "conv1",
      isGroup: false,
    } as never);

    mockPrisma.message.count.mockResolvedValueOnce(1 as never);

    mockPrisma.conversationParticipant.findFirst.mockResolvedValueOnce({
      userId: "u2",
      user: { email: null, emailOnNewChat: true },
    } as never);

    await sendMessage({ conversationId: "conv1", content: "Hey!" });

    expect(mockSendNewChatEmail).not.toHaveBeenCalled();
  });
});
