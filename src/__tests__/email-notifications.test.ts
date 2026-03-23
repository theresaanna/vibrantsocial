import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: { create: vi.fn(), findUnique: vi.fn() },
    post: { findUnique: vi.fn() },
    user: { update: vi.fn() },
    conversation: { update: vi.fn() },
    conversationParticipant: { findUnique: vi.fn(), update: vi.fn() },
    message: { create: vi.fn() },
  },
}));

vi.mock("@/lib/phone-gate", () => ({
  requirePhoneVerification: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendCommentEmail: vi.fn(),
  sendNewChatEmail: vi.fn(),
}));

vi.mock("@/lib/ably", () => ({
  getAblyRestClient: () => ({
    channels: {
      get: () => ({ publish: vi.fn() }),
    },
  }),
}));

const { mockInngestSend } = vi.hoisted(() => ({
  mockInngestSend: vi.fn(),
}));
vi.mock("@/lib/inngest", () => ({
  inngest: { send: mockInngestSend },
}));

vi.mock("@/lib/referral", () => ({
  awardReferralFirstPostBonus: vi.fn(),
  checkStarsMilestone: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { createComment } from "@/app/feed/post-actions";

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

    expect(mockInngestSend).toHaveBeenCalledWith({
      name: "email/comment",
      data: {
        toEmail: "author@example.com",
        commenterName: "Alice",
        postId: "p1",
      },
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

    expect(mockInngestSend).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "email/comment" })
    );
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

    expect(mockInngestSend).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "email/comment" })
    );
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

    expect(mockInngestSend).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "email/comment" })
    );
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

    expect(mockInngestSend).toHaveBeenCalledWith({
      name: "email/comment",
      data: {
        toEmail: "author@example.com",
        commenterName: "alice",
        postId: "p1",
      },
    });
  });
});

