import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateProfile, removeAvatar } from "@/app/profile/actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
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

describe("updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await updateProfile(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("validates username format - too short", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await updateProfile(prevState, makeFormData({ username: "ab" }));
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
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
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
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      username: "myusername",
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await updateProfile(
      prevState,
      makeFormData({ username: "myusername" })
    );
    expect(result.success).toBe(true);
  });

  it("updates profile with all fields", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
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
      data: {
        username: "newname",
        displayName: "New Name",
        bio: '{"root":{}}',
      },
    });
  });

  it("sets empty strings to null", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    await updateProfile(
      prevState,
      makeFormData({ username: "", displayName: "", bio: "" })
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { username: null, displayName: null, bio: null },
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
      avatar: "https://abc.public.blob.vercel-storage.com/avatars/user1-123.jpg",
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
