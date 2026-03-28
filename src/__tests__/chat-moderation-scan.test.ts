import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies before importing
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    message: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    conversationParticipant: { findMany: vi.fn() },
    chatAbuseFlag: { create: vi.fn(), count: vi.fn() },
    chatAbuseDismissal: { findUnique: vi.fn() },
    notification: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/ably", () => ({
  getAblyRestClient: vi.fn(() => ({
    channels: {
      get: vi.fn(() => ({
        publish: vi.fn(),
      })),
    },
  })),
}));
vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

// Capture the handler from inngest.createFunction
let capturedHandler: ((...args: unknown[]) => Promise<unknown>) | null = null;

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: vi.fn(
      (_opts: unknown, _trigger: unknown, handler: (...args: unknown[]) => Promise<unknown>) => {
        const opts = _opts as { id?: string };
        if (opts?.id === "scan-chat-message") {
          capturedHandler = handler;
        }
        return handler;
      }
    ),
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendCommentEmail: vi.fn(),
  sendNewChatEmail: vi.fn(),
  sendMentionEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  sendFriendRequestEmail: vi.fn(),
  sendNewPostEmail: vi.fn(),
  sendTagPostEmail: vi.fn(),
  sendTagDigestEmail: vi.fn(),
  sendContentNoticeEmail: vi.fn(),
  sendContentWarningEmail: vi.fn(),
  sendPostDeclinedEmail: vi.fn(),
  sendSuspensionEmail: vi.fn(),
  sendModerationAlertEmail: vi.fn(),
}));

// Stub env vars before module load
vi.stubEnv("MODERATION_API_URL", "http://localhost:8000");
vi.stubEnv("MODERATION_API_KEY", "test-key");

import { prisma } from "@/lib/prisma";
import { sendModerationAlertEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

// Force module evaluation
await import("@/lib/inngest-functions");

const mockPrisma = vi.mocked(prisma);
const mockSendAlert = vi.mocked(sendModerationAlertEmail);
const mockCreateNotification = vi.mocked(createNotification);

async function callHandler(messageId: string, senderId: string, conversationId: string) {
  if (!capturedHandler) throw new Error("Handler not captured");
  return capturedHandler({ event: { data: { messageId, senderId, conversationId } } });
}

describe("scanChatMessageFn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  const mockMessage = {
    id: "msg1",
    content: "hello world",
    mediaUrl: null,
    mediaType: null,
    deletedAt: null,
  };

  function setupMocks(messageOverrides = {}) {
    mockPrisma.message.findUnique.mockResolvedValue({
      ...mockMessage,
      ...messageOverrides,
    } as never);
    mockPrisma.message.update.mockResolvedValue({} as never);
    mockPrisma.conversationParticipant.findMany.mockResolvedValue([
      { userId: "recipient1" },
    ] as never);
    mockPrisma.chatAbuseFlag.create.mockResolvedValue({} as never);
    mockPrisma.chatAbuseFlag.count.mockResolvedValue(1 as never);
    mockPrisma.chatAbuseDismissal.findUnique.mockResolvedValue(null as never);
    mockPrisma.notification.findFirst.mockResolvedValue(null as never);
    mockPrisma.user.findUnique.mockResolvedValue({ username: "abuser" } as never);
  }

  function mockFetch(imageResult?: object, textResult?: object) {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (typeof url === "string" && url.includes("/scan/image")) {
          return {
            ok: true,
            json: async () => imageResult ?? { nsfw: false, score: 0.1 },
          };
        }
        if (typeof url === "string" && url.includes("/scan/text")) {
          return {
            ok: true,
            json: async () =>
              textResult ?? {
                toxicity: 0.01,
                identity_attack: 0.0,
                insult: 0.01,
                is_hate_speech: false,
                is_bullying: false,
              },
          };
        }
        return { ok: false };
      }
    );
  }

  it("skips deleted messages", async () => {
    setupMocks({ deletedAt: new Date() });
    mockFetch();

    const result = await callHandler("msg1", "sender1", "conv1");

    expect(result).toEqual(expect.objectContaining({ skipped: true }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("skips when message not found", async () => {
    mockPrisma.message.findUnique.mockResolvedValue(null as never);
    mockFetch();

    const result = await callHandler("msg1", "sender1", "conv1");

    expect(result).toEqual(expect.objectContaining({ skipped: true }));
  });

  describe("NSFW image detection in chat", () => {
    it("marks message as NSFW when image is flagged", async () => {
      setupMocks({ mediaUrl: "https://example.com/img.jpg", mediaType: "image" });
      mockFetch(
        { nsfw: true, score: 0.85 },
        { is_hate_speech: false, is_bullying: false, toxicity: 0.01, identity_attack: 0.0, insult: 0.01 }
      );

      const result = await callHandler("msg1", "sender1", "conv1");

      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: "msg1" },
        data: { isNsfw: true, nsfwScore: 0.85 },
      });
      expect(result).toEqual(expect.objectContaining({ nsfwDetected: true }));
    });

    it("scans video media URLs for NSFW", async () => {
      setupMocks({ mediaUrl: "https://example.com/vid.mp4", mediaType: "video" });
      mockFetch(
        { nsfw: true, score: 0.9 },
        { is_hate_speech: false, is_bullying: false, toxicity: 0.01, identity_attack: 0.0, insult: 0.01 }
      );

      await callHandler("msg1", "sender1", "conv1");

      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: "msg1" },
        data: { isNsfw: true, nsfwScore: 0.9 },
      });
    });

    it("does not mark clean images as NSFW", async () => {
      setupMocks({ mediaUrl: "https://example.com/img.jpg", mediaType: "image" });
      mockFetch(
        { nsfw: false, score: 0.1 },
        { is_hate_speech: false, is_bullying: false, toxicity: 0.01, identity_attack: 0.0, insult: 0.01 }
      );

      const result = await callHandler("msg1", "sender1", "conv1");

      expect(mockPrisma.message.update).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ nsfwDetected: false }));
    });

    it("does not scan audio media for NSFW", async () => {
      setupMocks({ mediaUrl: "https://example.com/audio.mp3", mediaType: "audio" });
      mockFetch();

      await callHandler("msg1", "sender1", "conv1");

      // fetch should only be called for text scan, not image scan
      const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const imageScanCalls = fetchCalls.filter(
        (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("/scan/image")
      );
      expect(imageScanCalls).toHaveLength(0);
    });
  });

  describe("abuse text detection in chat", () => {
    it("creates abuse flag when hate speech detected", async () => {
      setupMocks();
      mockFetch(undefined, {
        toxicity: 0.9,
        identity_attack: 0.85,
        insult: 0.3,
        is_hate_speech: true,
        is_bullying: false,
      });

      await callHandler("msg1", "sender1", "conv1");

      expect(mockPrisma.chatAbuseFlag.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          senderId: "sender1",
          recipientId: "recipient1",
          messageId: "msg1",
          violationType: "hate_speech",
        }),
      });
    });

    it("creates abuse flag when bullying detected", async () => {
      setupMocks();
      mockFetch(undefined, {
        toxicity: 0.5,
        identity_attack: 0.1,
        insult: 0.9,
        is_hate_speech: false,
        is_bullying: true,
      });

      await callHandler("msg1", "sender1", "conv1");

      expect(mockPrisma.chatAbuseFlag.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          violationType: "bullying",
        }),
      });
    });

    it("sends admin alert email for abusive chat messages", async () => {
      setupMocks();
      mockFetch(undefined, {
        toxicity: 0.9,
        identity_attack: 0.85,
        insult: 0.3,
        is_hate_speech: true,
        is_bullying: false,
      });

      await callHandler("msg1", "sender1", "conv1");

      expect(mockSendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          authorUsername: "abuser",
          violationType: "hate_speech",
          contentPreview: expect.stringContaining("[Chat message]"),
        })
      );
    });

    it("does not create abuse flag for clean text", async () => {
      setupMocks();
      mockFetch();

      await callHandler("msg1", "sender1", "conv1");

      expect(mockPrisma.chatAbuseFlag.create).not.toHaveBeenCalled();
    });
  });

  describe("abuse notification threshold", () => {
    it("does NOT notify recipient before reaching 3 flags", async () => {
      setupMocks();
      mockPrisma.chatAbuseFlag.count.mockResolvedValue(2 as never);
      mockFetch(undefined, {
        toxicity: 0.9,
        identity_attack: 0.85,
        insult: 0.3,
        is_hate_speech: true,
        is_bullying: false,
      });

      await callHandler("msg1", "sender1", "conv1");

      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it("notifies recipient after 3rd flag", async () => {
      setupMocks();
      mockPrisma.chatAbuseFlag.count.mockResolvedValue(3 as never);
      mockFetch(undefined, {
        toxicity: 0.9,
        identity_attack: 0.85,
        insult: 0.3,
        is_hate_speech: true,
        is_bullying: false,
      });

      await callHandler("msg1", "sender1", "conv1");

      expect(mockCreateNotification).toHaveBeenCalledWith({
        type: "CHAT_ABUSE",
        actorId: "sender1",
        targetUserId: "recipient1",
        messageId: "msg1",
      });
    });

    it("does NOT notify if recipient has dismissed alerts from that sender", async () => {
      setupMocks();
      mockPrisma.chatAbuseFlag.count.mockResolvedValue(5 as never);
      mockPrisma.chatAbuseDismissal.findUnique.mockResolvedValue({ id: "d1" } as never);
      mockFetch(undefined, {
        toxicity: 0.9,
        identity_attack: 0.85,
        insult: 0.3,
        is_hate_speech: true,
        is_bullying: false,
      });

      await callHandler("msg1", "sender1", "conv1");

      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it("does NOT create duplicate notification if one is already unread", async () => {
      setupMocks();
      mockPrisma.chatAbuseFlag.count.mockResolvedValue(5 as never);
      mockPrisma.notification.findFirst.mockResolvedValue({ id: "existing" } as never);
      mockFetch(undefined, {
        toxicity: 0.9,
        identity_attack: 0.85,
        insult: 0.3,
        is_hate_speech: true,
        is_bullying: false,
      });

      await callHandler("msg1", "sender1", "conv1");

      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it("creates flags for all recipients in group chats", async () => {
      setupMocks();
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([
        { userId: "recipient1" },
        { userId: "recipient2" },
        { userId: "recipient3" },
      ] as never);
      mockFetch(undefined, {
        toxicity: 0.9,
        identity_attack: 0.85,
        insult: 0.3,
        is_hate_speech: true,
        is_bullying: false,
      });

      await callHandler("msg1", "sender1", "conv1");

      expect(mockPrisma.chatAbuseFlag.create).toHaveBeenCalledTimes(3);
    });
  });
});
