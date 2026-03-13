import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

const mockInngestSend = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/inngest", () => ({
  inngest: {
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
}));

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import {
  extractMentionsFromLexicalJson,
  extractMentionsFromPlainText,
  createMentionNotifications,
} from "@/lib/mentions";

const mockPrisma = vi.mocked(prisma);
const mockCreateNotification = vi.mocked(createNotification);

describe("extractMentionsFromLexicalJson", () => {
  it("extracts mention usernames from Lexical JSON", () => {
    const json = JSON.stringify({
      root: {
        children: [
          {
            type: "paragraph",
            children: [
              { type: "text", text: "Hello " },
              { type: "mention", username: "alice", userId: "u1" },
              { type: "text", text: " and " },
              { type: "mention", username: "bob", userId: "u2" },
            ],
          },
        ],
      },
    });

    const result = extractMentionsFromLexicalJson(json);
    expect(result).toEqual(["alice", "bob"]);
  });

  it("handles nested children", () => {
    const json = JSON.stringify({
      root: {
        children: [
          {
            type: "paragraph",
            children: [
              {
                type: "link",
                children: [
                  { type: "mention", username: "deep_user", userId: "u3" },
                ],
              },
            ],
          },
        ],
      },
    });

    const result = extractMentionsFromLexicalJson(json);
    expect(result).toEqual(["deep_user"]);
  });

  it("deduplicates usernames (case-insensitive)", () => {
    const json = JSON.stringify({
      root: {
        children: [
          {
            type: "paragraph",
            children: [
              { type: "mention", username: "Alice", userId: "u1" },
              { type: "mention", username: "alice", userId: "u1" },
              { type: "mention", username: "ALICE", userId: "u1" },
            ],
          },
        ],
      },
    });

    const result = extractMentionsFromLexicalJson(json);
    expect(result).toEqual(["alice"]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(extractMentionsFromLexicalJson("not json")).toEqual([]);
  });

  it("returns empty array for JSON without root", () => {
    expect(extractMentionsFromLexicalJson(JSON.stringify({ foo: "bar" }))).toEqual([]);
  });

  it("returns empty array when no mentions exist", () => {
    const json = JSON.stringify({
      root: {
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "No mentions here" }],
          },
        ],
      },
    });

    expect(extractMentionsFromLexicalJson(json)).toEqual([]);
  });
});

describe("extractMentionsFromPlainText", () => {
  it("extracts @usernames from text", () => {
    const result = extractMentionsFromPlainText("Hello @alice and @bob_123!");
    expect(result).toEqual(["alice", "bob_123"]);
  });

  it("deduplicates usernames (case-insensitive)", () => {
    const result = extractMentionsFromPlainText("@Alice @alice @ALICE");
    expect(result).toEqual(["alice"]);
  });

  it("ignores usernames shorter than 3 characters", () => {
    const result = extractMentionsFromPlainText("@ab @abc @a");
    expect(result).toEqual(["abc"]);
  });

  it("truncates match at 30 characters for long usernames", () => {
    const longUsername = "a".repeat(31);
    const result = extractMentionsFromPlainText(`@${longUsername} @valid_user`);
    // Regex matches up to 30 chars, so "a".repeat(30) is captured
    expect(result).toEqual(["a".repeat(30), "valid_user"]);
  });

  it("returns empty array for text without mentions", () => {
    expect(extractMentionsFromPlainText("no mentions here")).toEqual([]);
  });

  it("matches @username even in email-like text", () => {
    // The regex matches @domain in email@domain.com since "domain" has 6 chars
    expect(extractMentionsFromPlainText("email@domain.com")).toEqual(["domain"]);
  });

  it("does not match @ with no valid username after it", () => {
    expect(extractMentionsFromPlainText("just an @ sign")).toEqual([]);
  });

  it("handles multiple @ symbols", () => {
    const result = extractMentionsFromPlainText("@user1 @user2 @user3");
    expect(result).toEqual(["user1", "user2", "user3"]);
  });
});

describe("createMentionNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({
      displayName: "Actor Name",
      username: "actor",
      name: null,
    } as any);
  });

  it("creates notifications and sends emails for valid users", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", email: "alice@example.com", emailOnMention: true } as any,
      { id: "u2", email: "bob@example.com", emailOnMention: true } as any,
    ]);
    mockCreateNotification.mockResolvedValue(undefined as any);

    await createMentionNotifications({
      usernames: ["alice", "bob"],
      actorId: "actor1",
      postId: "post1",
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { username: { in: ["alice", "bob"], mode: "insensitive" } },
      select: { id: true, email: true, emailOnMention: true },
    });

    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "MENTION",
      actorId: "actor1",
      targetUserId: "u1",
      postId: "post1",
      commentId: undefined,
    });
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "MENTION",
      actorId: "actor1",
      targetUserId: "u2",
      postId: "post1",
      commentId: undefined,
    });

    // Emails sent for both users via inngest
    expect(mockInngestSend).toHaveBeenCalledTimes(2);
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: "email/mention",
      data: {
        toEmail: "alice@example.com",
        mentionerName: "Actor Name",
        postId: "post1",
        commentId: undefined,
      },
    });
  });

  it("sends email with commentId when provided", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", email: "alice@example.com", emailOnMention: true } as any,
    ]);
    mockCreateNotification.mockResolvedValue(undefined as any);

    await createMentionNotifications({
      usernames: ["alice"],
      actorId: "actor1",
      postId: "post1",
      commentId: "comment1",
    });

    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "MENTION",
      actorId: "actor1",
      targetUserId: "u1",
      postId: "post1",
      commentId: "comment1",
    });

    expect(mockInngestSend).toHaveBeenCalledWith({
      name: "email/mention",
      data: {
        toEmail: "alice@example.com",
        mentionerName: "Actor Name",
        postId: "post1",
        commentId: "comment1",
      },
    });
  });

  it("does not send email when user has emailOnMention disabled", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", email: "alice@example.com", emailOnMention: false } as any,
    ]);
    mockCreateNotification.mockResolvedValue(undefined as any);

    await createMentionNotifications({
      usernames: ["alice"],
      actorId: "actor1",
      postId: "post1",
    });

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("does not send email when user has no email", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", email: null, emailOnMention: true } as any,
    ]);
    mockCreateNotification.mockResolvedValue(undefined as any);

    await createMentionNotifications({
      usernames: ["alice"],
      actorId: "actor1",
      postId: "post1",
    });

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("does not send email for self-mentions", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "actor1", email: "actor@example.com", emailOnMention: true } as any,
    ]);
    mockCreateNotification.mockResolvedValue(undefined as any);

    await createMentionNotifications({
      usernames: ["actor"],
      actorId: "actor1",
      postId: "post1",
    });

    // Notification is still created (self-mention prevention is in createNotification)
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    // But no email for self-mention
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("does nothing when usernames array is empty", async () => {
    await createMentionNotifications({
      usernames: [],
      actorId: "actor1",
      postId: "post1",
    });

    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("handles case where no users found in database", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    await createMentionNotifications({
      usernames: ["nonexistent"],
      actorId: "actor1",
      postId: "post1",
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("uses username as fallback actor name", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      displayName: null,
      username: "actor_user",
      name: null,
    } as any);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", email: "alice@example.com", emailOnMention: true } as any,
    ]);
    mockCreateNotification.mockResolvedValue(undefined as any);

    await createMentionNotifications({
      usernames: ["alice"],
      actorId: "actor1",
      postId: "post1",
    });

    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mentionerName: "actor_user" }),
      })
    );
  });
});
