import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/inngest", () => ({
  inngest: { createFunction: vi.fn(() => ({})) },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tagSubscription: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    postTag: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

const mockSendTagDigestEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendCommentEmail: vi.fn(),
  sendNewChatEmail: vi.fn(),
  sendMentionEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  sendFriendRequestEmail: vi.fn(),
  sendNewPostEmail: vi.fn(),
  sendTagPostEmail: vi.fn(),
  sendTagDigestEmail: (...args: unknown[]) => mockSendTagDigestEmail(...args),
}));

import { prisma } from "@/lib/prisma";
import { sendTagDigestEmails } from "@/lib/inngest-functions";

const mockPrisma = vi.mocked(prisma);

describe("sendTagDigestEmails", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns zero when no digest subscriptions exist", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([] as never);

    const result = await sendTagDigestEmails();

    expect(result.emailsSent).toBe(0);
    expect(mockSendTagDigestEmail).not.toHaveBeenCalled();
  });

  it("sends digest email when there are posts in subscribed tags", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      {
        id: "sub1",
        userId: "u1",
        tagId: "tag1",
        lastDigestSentAt: null,
        tag: { id: "tag1", name: "art" },
        user: { email: "user1@example.com", showNsfwContent: false },
      },
    ] as never);

    mockPrisma.postTag.findMany.mockResolvedValueOnce([
      {
        post: {
          id: "post1",
          author: { displayName: "Alice", username: "alice", name: null },
        },
        tag: { name: "art" },
      },
      {
        post: {
          id: "post2",
          author: { displayName: null, username: "bob", name: null },
        },
        tag: { name: "art" },
      },
    ] as never);

    mockPrisma.tagSubscription.updateMany.mockResolvedValueOnce({} as never);

    const result = await sendTagDigestEmails();

    expect(result.emailsSent).toBe(1);
    expect(mockSendTagDigestEmail).toHaveBeenCalledTimes(1);
    expect(mockSendTagDigestEmail).toHaveBeenCalledWith({
      toEmail: "user1@example.com",
      posts: expect.arrayContaining([
        expect.objectContaining({
          postId: "post1",
          authorName: "Alice",
          tagNames: ["art"],
        }),
        expect.objectContaining({
          postId: "post2",
          authorName: "bob",
          tagNames: ["art"],
        }),
      ]),
    });
  });

  it("does not send email when no posts exist for subscribed tags", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      {
        id: "sub1",
        userId: "u1",
        tagId: "tag1",
        lastDigestSentAt: null,
        tag: { id: "tag1", name: "art" },
        user: { email: "user1@example.com", showNsfwContent: false },
      },
    ] as never);

    mockPrisma.postTag.findMany.mockResolvedValueOnce([] as never);

    const result = await sendTagDigestEmails();

    expect(result.emailsSent).toBe(0);
    expect(mockSendTagDigestEmail).not.toHaveBeenCalled();
  });

  it("updates lastDigestSentAt after sending email", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      {
        id: "sub1",
        userId: "u1",
        tagId: "tag1",
        lastDigestSentAt: null,
        tag: { id: "tag1", name: "art" },
        user: { email: "user1@example.com", showNsfwContent: false },
      },
    ] as never);

    mockPrisma.postTag.findMany.mockResolvedValueOnce([
      {
        post: {
          id: "post1",
          author: { displayName: "Alice", username: "alice", name: null },
        },
        tag: { name: "art" },
      },
    ] as never);

    mockPrisma.tagSubscription.updateMany.mockResolvedValueOnce({} as never);

    await sendTagDigestEmails();

    expect(mockPrisma.tagSubscription.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["sub1"] } },
      data: { lastDigestSentAt: expect.any(Date) },
    });
  });

  it("groups posts by postId and collects tag names from multiple tags", async () => {
    // User subscribed to two tags
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      {
        id: "sub1",
        userId: "u1",
        tagId: "tag1",
        lastDigestSentAt: null,
        tag: { id: "tag1", name: "art" },
        user: { email: "user1@example.com", showNsfwContent: false },
      },
      {
        id: "sub2",
        userId: "u1",
        tagId: "tag2",
        lastDigestSentAt: null,
        tag: { id: "tag2", name: "digital" },
        user: { email: "user1@example.com", showNsfwContent: false },
      },
    ] as never);

    // Same post appears under both tags
    mockPrisma.postTag.findMany.mockResolvedValueOnce([
      {
        post: {
          id: "post1",
          author: { displayName: "Alice", username: "alice", name: null },
        },
        tag: { name: "art" },
      },
      {
        post: {
          id: "post1",
          author: { displayName: "Alice", username: "alice", name: null },
        },
        tag: { name: "digital" },
      },
    ] as never);

    mockPrisma.tagSubscription.updateMany.mockResolvedValueOnce({} as never);

    await sendTagDigestEmails();

    expect(mockSendTagDigestEmail).toHaveBeenCalledWith({
      toEmail: "user1@example.com",
      posts: [
        {
          postId: "post1",
          authorName: "Alice",
          tagNames: expect.arrayContaining(["art", "digital"]),
        },
      ],
    });
  });

  it("handles multiple users with separate digests", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      {
        id: "sub1",
        userId: "u1",
        tagId: "tag1",
        lastDigestSentAt: null,
        tag: { id: "tag1", name: "art" },
        user: { email: "user1@example.com", showNsfwContent: false },
      },
      {
        id: "sub2",
        userId: "u2",
        tagId: "tag1",
        lastDigestSentAt: null,
        tag: { id: "tag1", name: "art" },
        user: { email: "user2@example.com", showNsfwContent: false },
      },
    ] as never);

    // Both users get the same post
    mockPrisma.postTag.findMany
      .mockResolvedValueOnce([
        {
          post: {
            id: "post1",
            author: { displayName: "Alice", username: "alice", name: null },
          },
          tag: { name: "art" },
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          post: {
            id: "post1",
            author: { displayName: "Alice", username: "alice", name: null },
          },
          tag: { name: "art" },
        },
      ] as never);

    mockPrisma.tagSubscription.updateMany
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never);

    const result = await sendTagDigestEmails();

    expect(result.emailsSent).toBe(2);
    expect(mockSendTagDigestEmail).toHaveBeenCalledTimes(2);
  });

  it("continues processing other users when one email fails", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      {
        id: "sub1",
        userId: "u1",
        tagId: "tag1",
        lastDigestSentAt: null,
        tag: { id: "tag1", name: "art" },
        user: { email: "user1@example.com", showNsfwContent: false },
      },
      {
        id: "sub2",
        userId: "u2",
        tagId: "tag1",
        lastDigestSentAt: null,
        tag: { id: "tag1", name: "art" },
        user: { email: "user2@example.com", showNsfwContent: false },
      },
    ] as never);

    mockPrisma.postTag.findMany
      .mockResolvedValueOnce([
        {
          post: {
            id: "post1",
            author: { displayName: "Alice", username: "alice", name: null },
          },
          tag: { name: "art" },
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          post: {
            id: "post1",
            author: { displayName: "Alice", username: "alice", name: null },
          },
          tag: { name: "art" },
        },
      ] as never);

    // First email fails, second succeeds
    mockSendTagDigestEmail
      .mockRejectedValueOnce(new Error("Email send failed"))
      .mockResolvedValueOnce(undefined);

    mockPrisma.tagSubscription.updateMany.mockResolvedValueOnce({} as never);

    const result = await sendTagDigestEmails();

    // Only user2's email was successful
    expect(result.emailsSent).toBe(1);
    expect(mockSendTagDigestEmail).toHaveBeenCalledTimes(2);
    // updateMany should only be called for user2
    expect(mockPrisma.tagSubscription.updateMany).toHaveBeenCalledTimes(1);
  });

  it("uses fallback author name when displayName is null", async () => {
    mockPrisma.tagSubscription.findMany.mockResolvedValueOnce([
      {
        id: "sub1",
        userId: "u1",
        tagId: "tag1",
        lastDigestSentAt: null,
        tag: { id: "tag1", name: "art" },
        user: { email: "user1@example.com", showNsfwContent: false },
      },
    ] as never);

    mockPrisma.postTag.findMany.mockResolvedValueOnce([
      {
        post: {
          id: "post1",
          author: { displayName: null, username: null, name: null },
        },
        tag: { name: "art" },
      },
    ] as never);

    mockPrisma.tagSubscription.updateMany.mockResolvedValueOnce({} as never);

    await sendTagDigestEmails();

    expect(mockSendTagDigestEmail).toHaveBeenCalledWith({
      toEmail: "user1@example.com",
      posts: [
        expect.objectContaining({
          authorName: "Someone",
        }),
      ],
    });
  });
});
