import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createPost,
} from "@/app/feed/actions";
import {
  getScheduledPosts,
  updatePostSchedule,
  deleteScheduledPost,
  publishScheduledPostNow,
} from "@/app/compose/schedule-actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    postAudience: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    postTag: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    tag: {
      upsert: vi.fn().mockResolvedValue({ id: "tag1", name: "test" }),
    },
    friendRequest: { count: vi.fn() },
    postSubscription: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (fns: (() => Promise<unknown>)[]) => {
      for (const fn of fns) await fn;
    }),
  },
}));

vi.mock("@/lib/premium", () => ({
  checkAndExpirePremium: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: {},
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/phone-gate", () => ({
  requirePhoneVerification: vi.fn(),
}));

vi.mock("@/lib/age-gate", () => ({
  requireMinimumAge: vi.fn(),
}));

vi.mock("@/lib/suspension-gate", () => ({
  requireNotSuspended: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/subscription-notifications", () => ({
  notifyPostSubscribers: vi.fn(),
}));

vi.mock("@/lib/tag-subscription-notifications", () => ({
  notifyTagSubscribers: vi.fn(),
}));

vi.mock("@/lib/mentions", () => ({
  extractMentionsFromLexicalJson: vi.fn().mockReturnValue([]),
  createMentionNotifications: vi.fn(),
}));

vi.mock("@/lib/tags", () => ({
  extractTagsFromNames: vi.fn((names: string[]) => names),
}));

vi.mock("@/lib/slugs", () => ({
  generateSlugFromContent: vi.fn().mockReturnValue("test-slug"),
  validateSlug: vi.fn((s: string) => s),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  invalidatePattern: vi.fn(),
  cacheKeys: {
    tagCloud: () => "tagCloud",
    nsfwTagCloud: () => "nsfwTagCloud",
    tagPostCount: (name: string) => `tagPostCount:${name}`,
    profileTabFlags: (userId: string) => `profileTabFlags:${userId}`,
  },
}));

vi.mock("@/lib/referral", () => ({
  awardReferralFirstPostBonus: vi.fn(),
  checkStarsMilestone: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { send: vi.fn() },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireMinimumAge } from "@/lib/age-gate";
import { checkAndExpirePremium } from "@/lib/premium";
import { inngest } from "@/lib/inngest";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockPhoneGate = vi.mocked(requirePhoneVerification);
const mockAgeGate = vi.mocked(requireMinimumAge);
const mockCheckPremium = vi.mocked(checkAndExpirePremium);

const validLexicalContent = JSON.stringify({
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "This is a test post with enough content to pass validation",
            type: "text",
            version: 1,
          },
        ],
        type: "paragraph",
        version: 1,
      },
    ],
    type: "root",
    version: 1,
  },
});

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };

function setupAuthenticatedPremiumUser() {
  mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
  mockPhoneGate.mockResolvedValue(true);
  mockAgeGate.mockResolvedValue(true);
  mockCheckPremium.mockResolvedValue(true);
  mockPrisma.post.create.mockResolvedValue({
    id: "post1",
    slug: "test-slug",
    scheduledFor: new Date("2099-01-01"),
  } as never);
  mockPrisma.user.update.mockResolvedValue({} as never);
  mockPrisma.post.findUnique.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPost with scheduling", () => {
  it("requires premium for scheduling", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValue(true);
    mockAgeGate.mockResolvedValue(true);
    mockCheckPremium.mockResolvedValue(false);

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const fd = makeFormData({
      content: validLexicalContent,
      scheduledFor: futureDate,
    });

    const result = await createPost(prevState, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Scheduling posts is a premium feature");
  });

  it("rejects past scheduled dates", async () => {
    setupAuthenticatedPremiumUser();
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const fd = makeFormData({
      content: validLexicalContent,
      scheduledFor: pastDate,
    });

    const result = await createPost(prevState, fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Scheduled time must be in the future");
  });

  it("creates a scheduled post with scheduledFor set", async () => {
    setupAuthenticatedPremiumUser();
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const fd = makeFormData({
      content: validLexicalContent,
      scheduledFor: futureDate,
    });

    const result = await createPost(prevState, fd);
    expect(result.success).toBe(true);
    expect(result.message).toBe("Post scheduled");
    expect(mockPrisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scheduledFor: expect.any(Date),
        }),
      })
    );
  });

  it("does not trigger notifications or moderation for scheduled posts", async () => {
    setupAuthenticatedPremiumUser();
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const fd = makeFormData({
      content: validLexicalContent,
      scheduledFor: futureDate,
    });

    await createPost(prevState, fd);
    expect(vi.mocked(inngest).send).not.toHaveBeenCalled();
  });

  it("creates an immediate post when no scheduledFor is provided", async () => {
    setupAuthenticatedPremiumUser();
    const fd = makeFormData({ content: validLexicalContent });

    await createPost(prevState, fd);
    expect(mockPrisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scheduledFor: null,
        }),
      })
    );
  });
});

describe("getScheduledPosts", () => {
  it("returns empty array when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await getScheduledPosts();
    expect(result).toEqual([]);
  });

  it("fetches scheduled posts for the current user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    const posts = [
      { id: "p1", scheduledFor: new Date("2099-01-01"), content: "{}" },
    ];
    mockPrisma.post.findMany.mockResolvedValue(posts as never);

    const result = await getScheduledPosts();
    expect(result).toEqual(posts);
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          authorId: "user1",
          scheduledFor: { not: null, gt: expect.any(Date) },
        }),
      })
    );
  });
});

describe("updatePostSchedule", () => {
  it("requires authentication", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await updatePostSchedule("post1", new Date("2099-01-01").toISOString());
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("requires premium", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockCheckPremium.mockResolvedValue(false);
    const result = await updatePostSchedule("post1", new Date("2099-01-01").toISOString());
    expect(result.success).toBe(false);
    expect(result.message).toBe("Scheduling posts is a premium feature");
  });

  it("rejects if post is already published", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockCheckPremium.mockResolvedValue(true);
    mockPrisma.post.findUnique.mockResolvedValue({
      authorId: "user1",
      scheduledFor: null,
    } as never);

    const result = await updatePostSchedule("post1", new Date("2099-01-01").toISOString());
    expect(result.success).toBe(false);
    expect(result.message).toBe("Post is already published");
  });

  it("rejects past dates", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockCheckPremium.mockResolvedValue(true);
    mockPrisma.post.findUnique.mockResolvedValue({
      authorId: "user1",
      scheduledFor: new Date("2099-12-01"),
    } as never);

    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const result = await updatePostSchedule("post1", pastDate);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Scheduled time must be in the future");
  });

  it("updates the schedule for a valid request", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockCheckPremium.mockResolvedValue(true);
    mockPrisma.post.findUnique.mockResolvedValue({
      authorId: "user1",
      scheduledFor: new Date("2099-06-01"),
    } as never);
    mockPrisma.post.update.mockResolvedValue({} as never);

    const newDate = new Date("2099-12-01").toISOString();
    const result = await updatePostSchedule("post1", newDate);
    expect(result.success).toBe(true);
    expect(mockPrisma.post.update).toHaveBeenCalledWith({
      where: { id: "post1" },
      data: { scheduledFor: expect.any(Date) },
    });
  });

  it("rejects if post belongs to another user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockCheckPremium.mockResolvedValue(true);
    mockPrisma.post.findUnique.mockResolvedValue({
      authorId: "other-user",
      scheduledFor: new Date("2099-06-01"),
    } as never);

    const result = await updatePostSchedule("post1", new Date("2099-12-01").toISOString());
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authorized");
  });
});

describe("deleteScheduledPost", () => {
  it("requires authentication", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await deleteScheduledPost("post1");
    expect(result.success).toBe(false);
  });

  it("rejects if post is already published", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValue({
      authorId: "user1",
      scheduledFor: null,
    } as never);

    const result = await deleteScheduledPost("post1");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Post is already published");
  });

  it("deletes the scheduled post and decrements stars", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValue({
      authorId: "user1",
      scheduledFor: new Date("2099-06-01"),
    } as never);

    const result = await deleteScheduledPost("post1");
    expect(result.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});

describe("publishScheduledPostNow", () => {
  it("requires authentication", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await publishScheduledPostNow("post1");
    expect(result.success).toBe(false);
  });

  it("rejects if post is already published", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValue({
      authorId: "user1",
      scheduledFor: null,
    } as never);

    const result = await publishScheduledPostNow("post1");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Post is already published");
  });

  it("publishes by clearing scheduledFor and updating createdAt", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValue({
      authorId: "user1",
      scheduledFor: new Date("2099-06-01"),
    } as never);
    mockPrisma.post.update.mockResolvedValue({} as never);

    const result = await publishScheduledPostNow("post1");
    expect(result.success).toBe(true);
    expect(result.message).toBe("Post published");
    expect(mockPrisma.post.update).toHaveBeenCalledWith({
      where: { id: "post1" },
      data: { scheduledFor: null, createdAt: expect.any(Date) },
    });
  });
});
