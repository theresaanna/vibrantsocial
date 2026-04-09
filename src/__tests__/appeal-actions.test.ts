import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appeal: { create: vi.fn(), findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: {},
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { submitAppeal } from "@/app/appeal/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, val] of Object.entries(entries)) {
    fd.set(key, val);
  }
  return fd;
}

const initial = { success: false, message: "" };

describe("submitAppeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates appeal for logged-in user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockPrisma.appeal.findFirst.mockResolvedValue(null);
    mockPrisma.appeal.create.mockResolvedValue({} as never);

    const result = await submitAppeal(initial, makeFormData({
      type: "content_warning",
      reason: "I marked my post correctly",
    }));

    expect(result.success).toBe(true);
    expect(mockPrisma.appeal.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: "content_warning",
        reason: "I marked my post correctly",
      },
    });
  });

  it("rejects if user has pending appeal", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockPrisma.appeal.findFirst.mockResolvedValue({ id: "existing" } as never);

    const result = await submitAppeal(initial, makeFormData({
      type: "content_warning",
      reason: "test",
    }));

    expect(result.success).toBe(false);
    expect(result.message).toContain("pending appeal");
  });

  it("creates appeal for suspended user via email", async () => {
    mockAuth.mockResolvedValue(null as never);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-2", suspended: true } as never);
    mockPrisma.appeal.findFirst.mockResolvedValue(null);
    mockPrisma.appeal.create.mockResolvedValue({} as never);

    const result = await submitAppeal(initial, makeFormData({
      type: "suspension",
      reason: "I didn't do anything wrong",
      email: "user@example.com",
    }));

    expect(result.success).toBe(true);
    expect(mockPrisma.appeal.create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        type: "suspension",
        reason: "I didn't do anything wrong",
      },
    });
  });

  it("returns success even for unknown email (no info leak)", async () => {
    mockAuth.mockResolvedValue(null as never);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await submitAppeal(initial, makeFormData({
      type: "suspension",
      reason: "testing",
      email: "nonexistent@example.com",
    }));

    expect(result.success).toBe(true);
    expect(result.message).toContain("If an account exists");
    expect(mockPrisma.appeal.create).not.toHaveBeenCalled();
  });

  it("rejects empty reason", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const result = await submitAppeal(initial, makeFormData({
      type: "content_warning",
      reason: "",
    }));

    expect(result.success).toBe(false);
    expect(result.message).toContain("explain");
  });

  it("rejects reason over 2000 characters", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const result = await submitAppeal(initial, makeFormData({
      type: "content_warning",
      reason: "a".repeat(2001),
    }));

    expect(result.success).toBe(false);
    expect(result.message).toContain("2000");
  });

  it("requires email for non-logged-in users", async () => {
    mockAuth.mockResolvedValue(null as never);

    const result = await submitAppeal(initial, makeFormData({
      type: "suspension",
      reason: "test",
    }));

    expect(result.success).toBe(false);
    expect(result.message).toContain("email");
  });
});
