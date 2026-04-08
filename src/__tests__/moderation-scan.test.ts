import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies before importing
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
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
  sendContentNoticeEmail: vi.fn(),
  sendPostDeclinedEmail: vi.fn(),
  sendModerationAlertEmail: vi.fn(),
}));

// Stub env vars before module load
vi.stubEnv("MODERATION_API_URL", "http://localhost:8000");
vi.stubEnv("MODERATION_API_KEY", "test-key");

import { prisma } from "@/lib/prisma";
import {
  sendContentNoticeEmail,
  sendPostDeclinedEmail,
  sendModerationAlertEmail,
} from "@/lib/email";

// Force module evaluation
await import("@/lib/inngest-functions");

const mockPrisma = vi.mocked(prisma);
const mockSendAlert = vi.mocked(sendModerationAlertEmail);
const mockSendNotice = vi.mocked(sendContentNoticeEmail);
const mockSendDeclined = vi.mocked(sendPostDeclinedEmail);

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
    contentWarnings: 0,
    ageVerified: new Date(),
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
      contentWarnings: 1,
    } as never);
    mockPrisma.contentViolation.create.mockResolvedValue({} as never);
    mockPrisma.notification.create.mockResolvedValue({} as never);
    mockPrisma.post.update.mockResolvedValue({} as never);
    mockPrisma.post.delete.mockResolvedValue({} as never);
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

  describe("NSFW detection — warning-first system", () => {
    it("sends friendly notice (not strike) for first-time unmarked NSFW", async () => {
      const postWithImage = {
        ...mockPost,
        content: '{"root":{"children":[{"type":"image","src":"https://example.com/img.jpg"}],"type":"root"}}',
      };
      setupMocks();
      mockPrisma.post.findUnique.mockResolvedValue(postWithImage as never);
      mockPrisma.user.update.mockResolvedValue({ contentWarnings: 1 } as never);
      mockFetch(
        { nsfw: true, score: 0.7 },
        { is_hate_speech: false, is_bullying: false, toxicity: 0.01, identity_attack: 0.0, insult: 0.01 }
      );

      await callHandler("post1", "user1");

      // Should send notice, not strike warning
      expect(mockSendNotice).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: "user@example.com",
          postId: "post1",
          markingLabel: "nsfw (nudity)",
          warningCount: 1,
        })
      );
      expect(mockSendAlert).not.toHaveBeenCalled();
    });

    it("marks post as isNsfw for score < 0.85 (nudity)", async () => {
      const postWithImage = {
        ...mockPost,
        content: '{"root":{"children":[{"type":"image","src":"https://example.com/img.jpg"}],"type":"root"}}',
      };
      setupMocks();
      mockPrisma.post.findUnique.mockResolvedValue(postWithImage as never);
      mockFetch(
        { nsfw: true, score: 0.7 },
        { is_hate_speech: false, is_bullying: false, toxicity: 0.01, identity_attack: 0.0, insult: 0.01 }
      );

      await callHandler("post1", "user1");

      expect(mockPrisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isNsfw: true },
        })
      );
    });

    it("marks post as isGraphicNudity for score >= 0.85 (explicit)", async () => {
      const postWithImage = {
        ...mockPost,
        content: '{"root":{"children":[{"type":"image","src":"https://example.com/img.jpg"}],"type":"root"}}',
      };
      setupMocks();
      mockPrisma.post.findUnique.mockResolvedValue(postWithImage as never);
      mockFetch(
        { nsfw: true, score: 0.92 },
        { is_hate_speech: false, is_bullying: false, toxicity: 0.01, identity_attack: 0.0, insult: 0.01 }
      );

      await callHandler("post1", "user1");

      expect(mockPrisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isGraphicNudity: true },
        })
      );
    });

    it("continues sending notices beyond initial warnings (no strikes)", async () => {
      const postWithImage = {
        ...mockPost,
        content: '{"root":{"children":[{"type":"image","src":"https://example.com/img.jpg"}],"type":"root"}}',
      };
      setupMocks({}, { contentWarnings: 10 });
      mockPrisma.post.findUnique.mockResolvedValue(postWithImage as never);
      mockPrisma.user.update.mockResolvedValue({ contentWarnings: 11 } as never);
      mockFetch(
        { nsfw: true, score: 0.7 },
        { is_hate_speech: false, is_bullying: false, toxicity: 0.01, identity_attack: 0.0, insult: 0.01 }
      );

      await callHandler("post1", "user1");

      // Should still send a notice, never a strike
      expect(mockSendNotice).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: "user@example.com",
          postId: "post1",
          warningCount: 11,
        })
      );
    });
  });

  describe("NSFW detection — already marked post", () => {
    it("does NOT flag or warn when post is already marked NSFW", async () => {
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
      expect(mockSendNotice).not.toHaveBeenCalled();
    });

    it("does NOT flag or warn when post is marked graphic", async () => {
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

  describe("NSFW detection — non-age-verified user", () => {
    it("declines (deletes) post for graphic-level NSFW from non-verified user", async () => {
      const postWithImage = {
        ...mockPost,
        content: '{"root":{"children":[{"type":"image","src":"https://example.com/img.jpg"}],"type":"root"}}',
      };
      setupMocks({}, { ageVerified: null });
      mockPrisma.post.findUnique.mockResolvedValue(postWithImage as never);
      mockFetch(
        { nsfw: true, score: 0.92 },
        { is_hate_speech: false, is_bullying: false, toxicity: 0.01, identity_attack: 0.0, insult: 0.01 }
      );

      const result = await callHandler("post1", "user1");

      // Post should be deleted
      expect(mockPrisma.post.delete).toHaveBeenCalledWith({ where: { id: "post1" } });
      // Should send declined email, not notice or warning
      expect(mockSendDeclined).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: "user@example.com" })
      );
      expect(mockSendNotice).not.toHaveBeenCalled();
      // Should return postDeclined flag
      expect(result).toEqual(expect.objectContaining({ postDeclined: true }));
    });

    it("still auto-marks nudity-level NSFW for non-verified user (normal flow)", async () => {
      const postWithImage = {
        ...mockPost,
        content: '{"root":{"children":[{"type":"image","src":"https://example.com/img.jpg"}],"type":"root"}}',
      };
      setupMocks({}, { ageVerified: null });
      mockPrisma.post.findUnique.mockResolvedValue(postWithImage as never);
      mockFetch(
        { nsfw: true, score: 0.7 },
        { is_hate_speech: false, is_bullying: false, toxicity: 0.01, identity_attack: 0.0, insult: 0.01 }
      );

      await callHandler("post1", "user1");

      // Post should be marked as NSFW (not deleted)
      expect(mockPrisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isNsfw: true } })
      );
      expect(mockPrisma.post.delete).not.toHaveBeenCalled();
      expect(mockSendDeclined).not.toHaveBeenCalled();
      expect(mockSendNotice).toHaveBeenCalled();
    });
  });

  describe("clean content", () => {
    it("does not send any alert emails for clean content", async () => {
      setupMocks();
      mockFetch();

      await callHandler("post1", "user1");

      expect(mockSendAlert).not.toHaveBeenCalled();
      expect(mockSendNotice).not.toHaveBeenCalled();
    });
  });
});
