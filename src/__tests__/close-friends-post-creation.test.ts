import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPost } from "@/app/feed/actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    tag: {
      upsert: vi.fn(),
    },
    postTag: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/phone-gate", () => ({
  requirePhoneVerification: vi.fn(),
}));

vi.mock("@/lib/age-gate", () => ({
  requireMinimumAge: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/mentions", () => ({
  extractMentionsFromLexicalJson: vi.fn().mockReturnValue([]),
  createMentionNotifications: vi.fn(),
}));

vi.mock("@/lib/subscription-notifications", () => ({
  notifyPostSubscribers: vi.fn(),
}));

vi.mock("@/lib/tags", () => ({
  extractTagsFromNames: vi.fn((names: string[]) => names),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: {
    tagCloud: () => "tags:cloud",
    nsfwTagCloud: () => "tags:nsfw-cloud",
    tagPostCount: (name: string) => `tag:${name}:count`,
  },
}));

vi.mock("@/lib/referral", () => ({
  awardReferralFirstPostBonus: vi.fn(),
  checkStarsMilestone: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireMinimumAge } from "@/lib/age-gate";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockPhoneGate = vi.mocked(requirePhoneVerification);
const mockAgeGate = vi.mocked(requireMinimumAge);

const prevState = { success: false, message: "" };

// Minimal valid Lexical JSON (must be > 50 chars when stringified)
const validContent = JSON.stringify({
  root: {
    children: [
      {
        children: [{ text: "Hello world, this is a test post with enough content to pass validation!", type: "text" }],
        type: "paragraph",
      },
    ],
    type: "root",
  },
});

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

describe("createPost with isCloseFriendsOnly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValue(true);
    mockAgeGate.mockResolvedValue(true);
    mockPrisma.post.findFirst.mockResolvedValue(null as never); // no slug collision
  });

  it("creates a post with isCloseFriendsOnly=true", async () => {
    mockPrisma.post.create.mockResolvedValueOnce({
      id: "post1",
      slug: "test",
      content: validContent,
      authorId: "user1",
      isCloseFriendsOnly: true,
      isSensitive: false,
      isNsfw: false,
      isGraphicNudity: false,
    } as never);

    const result = await createPost(
      prevState,
      makeFormData({
        content: validContent,
        isSensitive: "false",
        isNsfw: "false",
        isGraphicNudity: "false",
        isCloseFriendsOnly: "true",
      })
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.post.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isCloseFriendsOnly: true,
      }),
    });
  });

  it("creates a post with isCloseFriendsOnly=false by default", async () => {
    mockPrisma.post.create.mockResolvedValueOnce({
      id: "post2",
      slug: "test",
      content: validContent,
      authorId: "user1",
      isCloseFriendsOnly: false,
      isSensitive: false,
      isNsfw: false,
      isGraphicNudity: false,
    } as never);

    const result = await createPost(
      prevState,
      makeFormData({
        content: validContent,
        isSensitive: "false",
        isNsfw: "false",
        isGraphicNudity: "false",
        isCloseFriendsOnly: "false",
      })
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.post.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isCloseFriendsOnly: false,
      }),
    });
  });

  it("treats missing isCloseFriendsOnly as false", async () => {
    mockPrisma.post.create.mockResolvedValueOnce({
      id: "post3",
      slug: "test",
      content: validContent,
      authorId: "user1",
      isCloseFriendsOnly: false,
      isSensitive: false,
      isNsfw: false,
      isGraphicNudity: false,
    } as never);

    const result = await createPost(
      prevState,
      makeFormData({
        content: validContent,
        isSensitive: "false",
        isNsfw: "false",
        isGraphicNudity: "false",
        // isCloseFriendsOnly not set
      })
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCloseFriendsOnly: false,
        }),
      })
    );
  });
});
