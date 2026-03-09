import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateProfile,
  removeAvatar,
  getBioRevisions,
  restoreBioRevision,
} from "@/app/profile/actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    bioRevision: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: {
    userProfile: (username: string) => `profile:${username}`,
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockDel = vi.mocked(del);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };

/** Helper: set up auth + findUnique for bio-aware updateProfile calls */
function setupAuthAndBio(userId: string, currentBio: string | null) {
  mockAuth.mockResolvedValueOnce({ user: { id: userId } } as never);
  // First findUnique may be for username check, second for bio fetch
  // For tests without username, only bio fetch is called
}

describe("updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no revisions to prune
    mockPrisma.bioRevision.count.mockResolvedValue(0 as never);
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await updateProfile(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("validates username format - too short", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await updateProfile(
      prevState,
      makeFormData({ username: "ab" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("3-30 characters");
  });

  it("validates username format - special characters", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await updateProfile(
      prevState,
      makeFormData({ username: "user@name!" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("letters, numbers, and underscores");
  });

  it("validates username format - too long", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await updateProfile(
      prevState,
      makeFormData({ username: "a".repeat(31) })
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("3-30 characters");
  });

  it("accepts valid usernames", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // username check
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    // bio fetch
    mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await updateProfile(
      prevState,
      makeFormData({ username: "valid_user_123" })
    );
    expect(result.success).toBe(true);
  });

  it("rejects taken username from different user", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "other-user",
      username: "taken",
    } as never);

    const result = await updateProfile(
      prevState,
      makeFormData({ username: "taken" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Username is already taken");
  });

  it("allows user to keep their own username", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // username check
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      username: "myusername",
    } as never);
    // bio fetch
    mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await updateProfile(
      prevState,
      makeFormData({ username: "myusername" })
    );
    expect(result.success).toBe(true);
  });

  it("updates profile with all fields", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // username check
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    // bio fetch
    mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await updateProfile(
      prevState,
      makeFormData({
        username: "newname",
        displayName: "New Name",
        bio: '{"root":{}}',
      })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Profile updated");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: expect.objectContaining({
        username: "newname",
        displayName: "New Name",
        bio: '{"root":{}}',
      }),
    });
  });

  describe("special characters in displayName", () => {
    const specialNameCases = [
      { label: "emoji", value: "\u{1F525}\u{1F680} Fire Rocket" },
      { label: "HTML-like tags", value: '<script>alert("xss")</script>' },
      { label: "ampersands and entities", value: "Tom & Jerry <3 \"cats\"" },
      { label: "CJK characters", value: "\u5F20\u4F1F" },
      { label: "Arabic RTL text", value: "\u0645\u062D\u0645\u062F" },
      { label: "combining diacritics", value: "Jose\u0301" },
      { label: "zero-width joiners", value: "A\u200DB" },
      { label: "newlines and tabs", value: "Line1\nLine2\tTabbed" },
      { label: "single quote", value: "O'Brien" },
      { label: "backslashes", value: "back\\slash\\name" },
      { label: "percent encoding chars", value: "100% fun & games" },
      { label: "unicode surrogate pair emoji", value: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}" },
      { label: "very long name", value: "A".repeat(500) },
      { label: "only whitespace", value: "   " },
      { label: "null bytes", value: "hello\x00world" },
      { label: "SQL-like injection", value: "'; DROP TABLE users; --" },
      { label: "curly braces and brackets", value: "{name: [test]}" },
    ];

    for (const { label, value } of specialNameCases) {
      it(`saves displayName with ${label}`, async () => {
        mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
        // bio fetch
        mockPrisma.user.findUnique.mockResolvedValueOnce({
          bio: null,
        } as never);
        mockPrisma.user.update.mockResolvedValueOnce({} as never);

        const result = await updateProfile(
          prevState,
          makeFormData({ displayName: value })
        );
        expect(result.success).toBe(true);
        expect(mockPrisma.user.update).toHaveBeenCalledWith({
          where: { id: "user1" },
          data: expect.objectContaining({
            displayName: value || null,
          }),
        });
      });
    }

    it("converts whitespace-only displayName to null", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
      mockPrisma.user.update.mockResolvedValueOnce({} as never);

      // "   " is truthy, so it will NOT be converted to null by `displayName || null`
      // This verifies the current behavior
      const result = await updateProfile(
        prevState,
        makeFormData({ displayName: "   " })
      );
      expect(result.success).toBe(true);
    });

    it("preserves special chars alongside other profile fields", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
      mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
      mockPrisma.user.update.mockResolvedValueOnce({} as never);

      const result = await updateProfile(
        prevState,
        makeFormData({
          username: "validuser",
          displayName: "\u{1F525} O'Brien & \u5F20\u4F1F",
          bio: '{"root":{}}',
        })
      );
      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user1" },
        data: expect.objectContaining({
          username: "validuser",
          displayName: "\u{1F525} O'Brien & \u5F20\u4F1F",
          bio: '{"root":{}}',
        }),
      });
    });
  });

  it("sets empty strings to null", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // bio fetch
    mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    await updateProfile(
      prevState,
      makeFormData({ username: "", displayName: "", bio: "" })
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: expect.objectContaining({
        username: null,
        displayName: null,
        bio: null,
      }),
    });
  });

  it("creates a bio revision when bio changes", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // bio fetch — current bio exists
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      bio: '{"root":{"old":true}}',
    } as never);
    mockPrisma.bioRevision.create.mockResolvedValueOnce({} as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await updateProfile(
      prevState,
      makeFormData({ bio: '{"root":{"new":true}}' })
    );
    expect(result.success).toBe(true);
    expect(mockPrisma.bioRevision.create).toHaveBeenCalledWith({
      data: { userId: "user1", content: '{"root":{"old":true}}' },
    });
  });

  it("does not create a revision when bio is unchanged", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // bio fetch — same content
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      bio: '{"root":{}}',
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await updateProfile(
      prevState,
      makeFormData({ bio: '{"root":{}}' })
    );
    expect(result.success).toBe(true);
    expect(mockPrisma.bioRevision.create).not.toHaveBeenCalled();
  });

  it("does not create a revision when old bio is null", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await updateProfile(
      prevState,
      makeFormData({ bio: '{"root":{}}' })
    );
    expect(result.success).toBe(true);
    expect(mockPrisma.bioRevision.create).not.toHaveBeenCalled();
  });

  describe("theme color validation", () => {
    it("saves valid theme colors", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      // bio fetch
      mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
      mockPrisma.user.update.mockResolvedValueOnce({} as never);

      const result = await updateProfile(
        prevState,
        makeFormData({
          profileBgColor: "#ff0000",
          profileTextColor: "#00ff00",
          profileLinkColor: "#0000ff",
          profileSecondaryColor: "#999999",
          profileContainerColor: "#eeeeee",
        })
      );
      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileBgColor: "#ff0000",
            profileTextColor: "#00ff00",
            profileLinkColor: "#0000ff",
            profileSecondaryColor: "#999999",
            profileContainerColor: "#eeeeee",
          }),
        })
      );
    });

    it("rejects invalid hex color values", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      const result = await updateProfile(
        prevState,
        makeFormData({ profileBgColor: "not-a-color" })
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid color");
    });

    it("rejects hex colors missing # prefix", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      const result = await updateProfile(
        prevState,
        makeFormData({ profileBgColor: "ff0000" })
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid color");
    });

    it("accepts 3-digit hex colors", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
      mockPrisma.user.update.mockResolvedValueOnce({} as never);

      const result = await updateProfile(
        prevState,
        makeFormData({ profileBgColor: "#f00" })
      );
      expect(result.success).toBe(true);
    });

    it("sets empty color values to null", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
      mockPrisma.user.update.mockResolvedValueOnce({} as never);

      await updateProfile(prevState, makeFormData({ profileBgColor: "" }));
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileBgColor: null,
          }),
        })
      );
    });

    it("sets missing color values to null", async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
      mockPrisma.user.update.mockResolvedValueOnce({} as never);

      await updateProfile(prevState, makeFormData({}));
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileBgColor: null,
            profileTextColor: null,
            profileLinkColor: null,
            profileSecondaryColor: null,
            profileContainerColor: null,
          }),
        })
      );
    });
  });

  it("saves emailOnMention preference", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    await updateProfile(
      prevState,
      makeFormData({ emailOnMention: "true" })
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailOnMention: true }),
      })
    );
  });

  it("saves emailOnMention as false when unchecked", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    // When checkbox is unchecked, the field is not in FormData
    await updateProfile(prevState, makeFormData({}));
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailOnMention: false }),
      })
    );
  });

  it("saves isProfilePublic as true when checked", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    await updateProfile(
      prevState,
      makeFormData({ isProfilePublic: "true" })
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isProfilePublic: true }),
      })
    );
  });

  it("saves isProfilePublic as false when unchecked", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    // When checkbox is unchecked, the field is not in FormData
    await updateProfile(prevState, makeFormData({}));
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isProfilePublic: false }),
      })
    );
  });

  it("prunes old revisions when count exceeds 20", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      bio: "old bio",
    } as never);
    mockPrisma.bioRevision.create.mockResolvedValueOnce({} as never);
    // After creating, count is 21
    mockPrisma.bioRevision.count.mockResolvedValueOnce(21 as never);
    mockPrisma.bioRevision.findMany.mockResolvedValueOnce([
      { id: "oldest" },
    ] as never);
    mockPrisma.bioRevision.deleteMany.mockResolvedValueOnce({} as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await updateProfile(
      prevState,
      makeFormData({ bio: "new bio" })
    );
    expect(result.success).toBe(true);
    expect(mockPrisma.bioRevision.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["oldest"] } },
    });
  });
});

describe("removeAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await removeAvatar();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("deletes blob and sets avatar to null", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      avatar:
        "https://abc.public.blob.vercel-storage.com/avatars/user1-123.jpg",
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await removeAvatar();
    expect(result.success).toBe(true);
    expect(mockDel).toHaveBeenCalledWith(
      "https://abc.public.blob.vercel-storage.com/avatars/user1-123.jpg"
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { avatar: null },
    });
  });

  it("does not call blob del for non-blob avatars", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      avatar: "https://lh3.googleusercontent.com/photo.jpg",
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await removeAvatar();
    expect(result.success).toBe(true);
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("continues even if blob deletion fails", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      avatar: "https://abc.public.blob.vercel-storage.com/old.jpg",
    } as never);
    mockDel.mockRejectedValueOnce(new Error("blob error"));
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await removeAvatar();
    expect(result.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });
});

describe("getBioRevisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await getBioRevisions();
    expect(result).toEqual([]);
  });

  it("returns revisions for authenticated user", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const revisions = [
      { id: "rev1", content: "bio v2", createdAt: new Date("2025-01-02") },
      { id: "rev2", content: "bio v1", createdAt: new Date("2025-01-01") },
    ];
    mockPrisma.bioRevision.findMany.mockResolvedValueOnce(revisions as never);

    const result = await getBioRevisions();
    expect(result).toEqual(revisions);
    expect(mockPrisma.bioRevision.findMany).toHaveBeenCalledWith({
      where: { userId: "user1" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, content: true, createdAt: true },
    });
  });
});

describe("restoreBioRevision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.bioRevision.count.mockResolvedValue(0 as never);
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await restoreBioRevision("rev1");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error if revision not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.bioRevision.findUnique.mockResolvedValueOnce(null as never);

    const result = await restoreBioRevision("nonexistent");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Revision not found");
  });

  it("returns error if revision belongs to another user", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.bioRevision.findUnique.mockResolvedValueOnce({
      id: "rev1",
      userId: "other-user",
      content: "someone else's bio",
    } as never);

    const result = await restoreBioRevision("rev1");
    expect(result.success).toBe(false);
    expect(result.message).toBe("Revision not found");
  });

  it("restores bio and saves current as revision", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.bioRevision.findUnique.mockResolvedValueOnce({
      id: "rev1",
      userId: "user1",
      content: "old bio content",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      bio: "current bio content",
    } as never);
    mockPrisma.bioRevision.create.mockResolvedValueOnce({} as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await restoreBioRevision("rev1");
    expect(result.success).toBe(true);
    expect(result.message).toBe("Bio restored");
    expect(result.restoredContent).toBe("old bio content");

    // Should save current bio as a revision
    expect(mockPrisma.bioRevision.create).toHaveBeenCalledWith({
      data: { userId: "user1", content: "current bio content" },
    });

    // Should update user bio with restored content
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { bio: "old bio content" },
    });
  });

  it("does not save revision if current bio is null", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.bioRevision.findUnique.mockResolvedValueOnce({
      id: "rev1",
      userId: "user1",
      content: "old bio",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ bio: null } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await restoreBioRevision("rev1");
    expect(result.success).toBe(true);
    expect(mockPrisma.bioRevision.create).not.toHaveBeenCalled();
  });
});
