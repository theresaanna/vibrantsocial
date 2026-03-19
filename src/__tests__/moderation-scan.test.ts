import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies before importing
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    contentViolation: { create: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

// Capture the handler from inngest.createFunction
let capturedHandler: ((...args: unknown[]) => Promise<unknown>) | null = null;

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: vi.fn(
      (_opts: unknown, _trigger: unknown, handler: (...args: unknown[]) => Promise<unknown>) => {
        // The scan-post-content function is the last one created
        // We capture all handlers and use the one for scan-post-content
        const opts = _opts as { id?: string };
        if (opts?.id === "scan-post-content") {
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
  sendContentWarningEmail: vi.fn(),
  sendSuspensionEmail: vi.fn(),
  sendModerationAlertEmail: vi.fn(),
}));

// Stub env vars before module load
vi.stubEnv("MODERATION_API_URL", "http://localhost:8000");
vi.stubEnv("MODERATION_API_KEY", "test-key");

import { prisma } from "@/lib/prisma";
import {
  sendContentWarningEmail,
  sendModerationAlertEmail,
} from "@/lib/email";

// Force module evaluation
await import("@/lib/inngest-functions");

const mockPrisma = vi.mocked(prisma);
const mockSendAlert = vi.mocked(sendModerationAlertEmail);
const mockSendWarning = vi.mocked(sendContentWarningEmail);

async function callHandler(postId: string, userId: string) {
  if (!capturedHandler) throw new Error("Handler not captured");
  return capturedHandler({ event: { data: { postId, userId } } });
}

describe("scanPostContentFn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  const mockPost = {
    id: "post1",
    content: '{"root":{"children":[{"children":[{"text":"hello world","type":"text"}],"type":"paragraph"}],"type":"root"}}',
    isNsfw: false,
    isGraphicNudity: false,
    isSensitive: false,
    authorId: "user1",
  };

  const mockUser = {
    id: "user1",
    email: "user@example.com",
    username: "testuser",
    contentStrikes: 0,
  };

  function setupMocks(postOverrides = {}, userOverrides = {}) {
    mockPrisma.post.findUnique.mockResolvedValue({
      ...mockPost,
      ...postOverrides,
    } as never);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      ...userOverrides,
    } as never);
    mockPrisma.user.update.mockResolvedValue({
      contentStrikes: 1,
    } as never);
    mockPrisma.contentViolation.create.mockResolvedValue({} as never);
    mockPrisma.notification.create.mockResolvedValue({} as never);
    mockPrisma.post.update.mockResolvedValue({} as never);
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

  describe("NSFW detection — unmarked post", () => {
    it("sends admin alert email when NSFW detected on unmarked post", async () => {
      const postWithImage = {
        ...mockPost,
        isNsfw: false,
        isGraphicNudity: false,
        content: '{"root":{"children":[{"type":"image","src":"https://example.com/img.jpg"},{"children":[{"text":"some text","type":"text"}],"type":"paragraph"}],"type":"root"}}',
      };
      setupMocks();
      mockPrisma.post.findUnique.mockResolvedValue(postWithImage as never);
      mockFetch(
        { nsfw: true, score: 0.92 },
        { is_hate_speech: false, is_bullying: false, toxicity: 0.01, identity_attack: 0.0, insult: 0.01 }
      );

      await callHandler("post1", "user1");

      expect(mockSendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: "post1",
          authorUsername: "testuser",
          violationType: "nsfw_unmarked",
          confidence: 0.92,
        })
      );
    });

    it("sends content warning email to user for unmarked NSFW", async () => {
      const postWithImage = {
        ...mockPost,
        isNsfw: false,
        isGraphicNudity: false,
        content: '{"root":{"children":[{"type":"image","src":"https://example.com/img.jpg"}],"type":"root"}}',
      };
      setupMocks();
      mockPrisma.post.findUnique.mockResolvedValue(postWithImage as never);
      mockFetch(
        { nsfw: true, score: 0.9 },
        { is_hate_speech: false, is_bullying: false, toxicity: 0.01, identity_attack: 0.0, insult: 0.01 }
      );

      await callHandler("post1", "user1");

      expect(mockSendWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: "user@example.com",
          postId: "post1",
          violationType: "nsfw_unmarked",
        })
      );
    });
  });

  describe("NSFW detection — already marked post", () => {
    it("does NOT send admin alert when post is already marked NSFW", async () => {
      const postWithImage = {
        ...mockPost,
        isNsfw: true,
        content: '{"root":{"children":[{"type":"image","src":"https://example.com/img.jpg"}],"type":"root"}}',
      };
      setupMocks();
      mockPrisma.post.findUnique.mockResolvedValue(postWithImage as never);
      mockFetch(
        { nsfw: true, score: 0.95 },
        { is_hate_speech: false, is_bullying: false, toxicity: 0.01, identity_attack: 0.0, insult: 0.01 }
      );

      await callHandler("post1", "user1");

      expect(mockSendAlert).not.toHaveBeenCalled();
      expect(mockSendWarning).not.toHaveBeenCalled();
    });

    it("does NOT send admin alert when post is marked graphic", async () => {
      const postWithImage = {
        ...mockPost,
        isGraphicNudity: true,
        content: '{"root":{"children":[{"type":"image","src":"https://example.com/img.jpg"}],"type":"root"}}',
      };
      setupMocks();
      mockPrisma.post.findUnique.mockResolvedValue(postWithImage as never);
      mockFetch(
        { nsfw: true, score: 0.95 },
        { is_hate_speech: false, is_bullying: false, toxicity: 0.01, identity_attack: 0.0, insult: 0.01 }
      );

      await callHandler("post1", "user1");

      expect(mockSendAlert).not.toHaveBeenCalled();
    });
  });

  describe("hate speech detection", () => {
    it("sends admin alert email when hate speech detected", async () => {
      setupMocks();
      mockFetch(undefined, {
        toxicity: 0.8,
        identity_attack: 0.85,
        insult: 0.3,
        is_hate_speech: true,
        is_bullying: false,
      });

      await callHandler("post1", "user1");

      expect(mockSendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: "post1",
          authorUsername: "testuser",
          violationType: "hate_speech",
        })
      );
    });

    it("sends admin alert email when bullying detected", async () => {
      setupMocks();
      mockFetch(undefined, {
        toxicity: 0.5,
        identity_attack: 0.1,
        insult: 0.9,
        is_hate_speech: false,
        is_bullying: true,
      });

      await callHandler("post1", "user1");

      expect(mockSendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          violationType: "bullying",
        })
      );
    });
  });

  describe("clean content", () => {
    it("does not send any alert emails for clean content", async () => {
      setupMocks();
      mockFetch();

      await callHandler("post1", "user1");

      expect(mockSendAlert).not.toHaveBeenCalled();
      expect(mockSendWarning).not.toHaveBeenCalled();
    });
  });
});
