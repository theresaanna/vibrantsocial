import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishScheduledPosts } from "@/lib/inngest-functions";

vi.mock("@/lib/inngest", () => ({
  inngest: {
    send: vi.fn(),
    createFunction: vi.fn((_opts: unknown, _trigger: unknown, fn: unknown) => fn),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/mentions", () => ({
  extractMentionsFromLexicalJson: vi.fn().mockReturnValue([]),
  createMentionNotifications: vi.fn(),
}));

vi.mock("@/lib/subscription-notifications", () => ({
  notifyPostSubscribers: vi.fn(),
}));

vi.mock("@/lib/tag-subscription-notifications", () => ({
  notifyTagSubscribers: vi.fn(),
}));

vi.mock("@/lib/referral", () => ({
  awardReferralFirstPostBonus: vi.fn(),
  checkStarsMilestone: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  invalidatePattern: vi.fn(),
  cacheKeys: {
    profileTabFlags: (userId: string) => `profileTabFlags:${userId}`,
  },
}));

vi.mock("@/lib/email", () => ({}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest";
import { notifyPostSubscribers } from "@/lib/subscription-notifications";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("publishScheduledPosts", () => {
  it("returns 0 when no posts are due", async () => {
    mockPrisma.post.findMany.mockResolvedValue([]);
    const result = await publishScheduledPosts();
    expect(result.published).toBe(0);
  });

  it("publishes due posts by clearing scheduledFor", async () => {
    const scheduledTime = new Date("2026-04-05T12:00:00Z");
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: "post1",
        content: '{"root":{"children":[]}}',
        authorId: "user1",
        scheduledFor: scheduledTime,
        isSensitive: false,
        isNsfw: false,
        isGraphicNudity: false,
        isCloseFriendsOnly: false,
        hasCustomAudience: false,
        tags: [],
        audience: [],
      },
    ] as never);
    mockPrisma.post.update.mockResolvedValue({} as never);

    const result = await publishScheduledPosts();
    expect(result.published).toBe(1);
    expect(mockPrisma.post.update).toHaveBeenCalledWith({
      where: { id: "post1" },
      data: { scheduledFor: null, createdAt: scheduledTime },
    });
  });

  it("triggers moderation scan for published posts", async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: "post1",
        content: '{"root":{"children":[]}}',
        authorId: "user1",
        scheduledFor: new Date("2026-04-05T12:00:00Z"),
        isSensitive: false,
        isNsfw: false,
        isGraphicNudity: false,
        isCloseFriendsOnly: false,
        hasCustomAudience: false,
        tags: [],
        audience: [],
      },
    ] as never);
    mockPrisma.post.update.mockResolvedValue({} as never);

    await publishScheduledPosts();
    expect(vi.mocked(inngest).send).toHaveBeenCalledWith({
      name: "moderation/scan-post",
      data: { postId: "post1", userId: "user1" },
    });
  });

  it("sends subscriber notifications for published posts", async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: "post1",
        content: '{"root":{"children":[]}}',
        authorId: "user1",
        scheduledFor: new Date("2026-04-05T12:00:00Z"),
        isSensitive: false,
        isNsfw: false,
        isGraphicNudity: false,
        isCloseFriendsOnly: false,
        hasCustomAudience: false,
        tags: [],
        audience: [{ userId: "friend1" }],
      },
    ] as never);
    mockPrisma.post.update.mockResolvedValue({} as never);

    await publishScheduledPosts();
    expect(vi.mocked(notifyPostSubscribers)).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: "user1",
        postId: "post1",
        customAudienceIds: ["friend1"],
      })
    );
  });

  it("skips posts with no authorId", async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: "post1",
        content: "{}",
        authorId: null,
        scheduledFor: new Date("2026-04-05T12:00:00Z"),
        isSensitive: false,
        isNsfw: false,
        isGraphicNudity: false,
        isCloseFriendsOnly: false,
        hasCustomAudience: false,
        tags: [],
        audience: [],
      },
    ] as never);

    const result = await publishScheduledPosts();
    expect(result.published).toBe(0);
    expect(mockPrisma.post.update).not.toHaveBeenCalled();
  });
});
