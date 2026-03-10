import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/inngest", () => ({
  inngest: { createFunction: vi.fn(() => ({})) },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversationParticipant: { findMany: vi.fn(), update: vi.fn() },
    message: { count: vi.fn(), findFirst: vi.fn() },
  },
}));

const mockSendNewChatEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendCommentEmail: vi.fn(),
  sendNewChatEmail: (...args: unknown[]) => mockSendNewChatEmail(...args),
  sendMentionEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  sendFriendRequestEmail: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { pollChatEmailNotifications } from "@/lib/inngest-functions";

const mockPrisma = vi.mocked(prisma);

describe("pollChatEmailNotifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends one email per user per conversation with unread messages", async () => {
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([
      {
        id: "cp1",
        userId: "u1",
        conversationId: "conv1",
        lastReadAt: new Date("2024-01-01T12:00:00Z"),
        chatEmailSentAt: null,
        user: { email: "user1@example.com" },
      },
      {
        id: "cp2",
        userId: "u2",
        conversationId: "conv2",
        lastReadAt: new Date("2024-01-01T12:00:00Z"),
        chatEmailSentAt: null,
        user: { email: "user2@example.com" },
      },
    ] as never);

    // u1 has 10 unread messages, u2 has 1
    mockPrisma.message.count
      .mockResolvedValueOnce(10 as never)
      .mockResolvedValueOnce(1 as never);

    mockPrisma.message.findFirst
      .mockResolvedValueOnce({
        id: "m10",
        senderId: "sender1",
        sender: { displayName: "Alice", username: "alice", name: null },
      } as never)
      .mockResolvedValueOnce({
        id: "m1",
        senderId: "sender2",
        sender: { displayName: "Bob", username: "bob", name: null },
      } as never);

    mockPrisma.conversationParticipant.update.mockResolvedValue({} as never);

    const result = await pollChatEmailNotifications();

    expect(result.emailsSent).toBe(2);
    expect(mockSendNewChatEmail).toHaveBeenCalledTimes(2);
    expect(mockSendNewChatEmail).toHaveBeenCalledWith({
      toEmail: "user1@example.com",
      senderName: "Alice",
      conversationId: "conv1",
    });
    expect(mockSendNewChatEmail).toHaveBeenCalledWith({
      toEmail: "user2@example.com",
      senderName: "Bob",
      conversationId: "conv2",
    });
  });

  it("does not send email if already emailed for current unread batch", async () => {
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([
      {
        id: "cp1",
        userId: "u1",
        conversationId: "conv1",
        lastReadAt: new Date("2024-01-01T12:00:00Z"),
        // Already emailed after lastReadAt
        chatEmailSentAt: new Date("2024-01-01T13:00:00Z"),
        user: { email: "user1@example.com" },
      },
    ] as never);

    const result = await pollChatEmailNotifications();

    expect(result.emailsSent).toBe(0);
    expect(mockSendNewChatEmail).not.toHaveBeenCalled();
    expect(mockPrisma.message.count).not.toHaveBeenCalled();
  });

  it("sends email again after user reads and new messages arrive", async () => {
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([
      {
        id: "cp1",
        userId: "u1",
        conversationId: "conv1",
        // User read at 2pm, email was sent at 1pm (before read)
        lastReadAt: new Date("2024-01-01T14:00:00Z"),
        chatEmailSentAt: new Date("2024-01-01T13:00:00Z"),
        user: { email: "user1@example.com" },
      },
    ] as never);

    mockPrisma.message.count.mockResolvedValueOnce(3 as never);
    mockPrisma.message.findFirst.mockResolvedValueOnce({
      id: "m3",
      senderId: "sender1",
      sender: { displayName: "Alice", username: "alice", name: null },
    } as never);
    mockPrisma.conversationParticipant.update.mockResolvedValue({} as never);

    const result = await pollChatEmailNotifications();

    expect(result.emailsSent).toBe(1);
    expect(mockSendNewChatEmail).toHaveBeenCalledTimes(1);
  });

  it("does not send email if no unread messages", async () => {
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([
      {
        id: "cp1",
        userId: "u1",
        conversationId: "conv1",
        lastReadAt: new Date("2024-01-01T12:00:00Z"),
        chatEmailSentAt: null,
        user: { email: "user1@example.com" },
      },
    ] as never);

    mockPrisma.message.count.mockResolvedValueOnce(0 as never);

    const result = await pollChatEmailNotifications();

    expect(result.emailsSent).toBe(0);
    expect(mockSendNewChatEmail).not.toHaveBeenCalled();
  });

  it("handles participant with null lastReadAt (never read)", async () => {
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([
      {
        id: "cp1",
        userId: "u1",
        conversationId: "conv1",
        lastReadAt: null,
        chatEmailSentAt: null,
        user: { email: "user1@example.com" },
      },
    ] as never);

    mockPrisma.message.count.mockResolvedValueOnce(5 as never);
    mockPrisma.message.findFirst.mockResolvedValueOnce({
      id: "m5",
      senderId: "sender1",
      sender: { displayName: null, username: "alice", name: null },
    } as never);
    mockPrisma.conversationParticipant.update.mockResolvedValue({} as never);

    const result = await pollChatEmailNotifications();

    expect(result.emailsSent).toBe(1);
    expect(mockSendNewChatEmail).toHaveBeenCalledWith({
      toEmail: "user1@example.com",
      senderName: "alice",
      conversationId: "conv1",
    });
  });

  it("skips if chatEmailSentAt is set and lastReadAt is null", async () => {
    // Already emailed, user has never read — should not email again
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([
      {
        id: "cp1",
        userId: "u1",
        conversationId: "conv1",
        lastReadAt: null,
        chatEmailSentAt: new Date("2024-01-01T13:00:00Z"),
        user: { email: "user1@example.com" },
      },
    ] as never);

    const result = await pollChatEmailNotifications();

    expect(result.emailsSent).toBe(0);
    expect(mockSendNewChatEmail).not.toHaveBeenCalled();
  });

  it("updates chatEmailSentAt after sending email", async () => {
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([
      {
        id: "cp1",
        userId: "u1",
        conversationId: "conv1",
        lastReadAt: new Date("2024-01-01T12:00:00Z"),
        chatEmailSentAt: null,
        user: { email: "user1@example.com" },
      },
    ] as never);

    mockPrisma.message.count.mockResolvedValueOnce(1 as never);
    mockPrisma.message.findFirst.mockResolvedValueOnce({
      id: "m1",
      senderId: "sender1",
      sender: { displayName: "Alice", username: "alice", name: null },
    } as never);
    mockPrisma.conversationParticipant.update.mockResolvedValue({} as never);

    await pollChatEmailNotifications();

    expect(mockPrisma.conversationParticipant.update).toHaveBeenCalledWith({
      where: { id: "cp1" },
      data: { chatEmailSentAt: expect.any(Date) },
    });
  });

  it("uses fallback name when sender has no displayName or username", async () => {
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([
      {
        id: "cp1",
        userId: "u1",
        conversationId: "conv1",
        lastReadAt: new Date("2024-01-01T12:00:00Z"),
        chatEmailSentAt: null,
        user: { email: "user1@example.com" },
      },
    ] as never);

    mockPrisma.message.count.mockResolvedValueOnce(1 as never);
    mockPrisma.message.findFirst.mockResolvedValueOnce({
      id: "m1",
      senderId: "sender1",
      sender: { displayName: null, username: null, name: null },
    } as never);
    mockPrisma.conversationParticipant.update.mockResolvedValue({} as never);

    await pollChatEmailNotifications();

    expect(mockSendNewChatEmail).toHaveBeenCalledWith({
      toEmail: "user1@example.com",
      senderName: "Someone",
      conversationId: "conv1",
    });
  });

  it("returns zero when no participants found", async () => {
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([] as never);

    const result = await pollChatEmailNotifications();

    expect(result.emailsSent).toBe(0);
    expect(mockSendNewChatEmail).not.toHaveBeenCalled();
  });

  it("sends one email per conversation even with 10 unread messages from the same sender", async () => {
    mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce([
      {
        id: "cp1",
        userId: "u1",
        conversationId: "conv1",
        lastReadAt: new Date("2024-01-01T12:00:00Z"),
        chatEmailSentAt: null,
        user: { email: "user1@example.com" },
      },
    ] as never);

    // 10 unread messages from the same sender
    mockPrisma.message.count.mockResolvedValueOnce(10 as never);
    mockPrisma.message.findFirst.mockResolvedValueOnce({
      id: "m10",
      senderId: "sender1",
      sender: { displayName: "Alice", username: "alice", name: null },
    } as never);
    mockPrisma.conversationParticipant.update.mockResolvedValue({} as never);

    const result = await pollChatEmailNotifications();

    // Only 1 email sent despite 10 messages
    expect(result.emailsSent).toBe(1);
    expect(mockSendNewChatEmail).toHaveBeenCalledTimes(1);
  });
});
