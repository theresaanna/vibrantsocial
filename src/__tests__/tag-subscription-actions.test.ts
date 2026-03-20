import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tagSubscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    tag: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  toggleTagSubscription,
  updateTagSubscriptionFrequency,
  updateTagSubscriptionEmail,
  getTagSubscriptionStatus,
} from "@/app/feed/tag-subscription-actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

describe("toggleTagSubscription", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.set("tagId", "tag1");

    const result = await toggleTagSubscription(
      { success: false, message: "" },
      formData
    );

    expect(result).toEqual({
      success: false,
      message: "Not authenticated",
    });
  });

  it("returns error when tagId is missing", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    const formData = new FormData();

    const result = await toggleTagSubscription(
      { success: false, message: "" },
      formData
    );

    expect(result).toEqual({
      success: false,
      message: "Tag ID required",
    });
  });

  it("creates subscription when none exists", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.tagSubscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.tagSubscription.create.mockResolvedValueOnce({} as never);

    const formData = new FormData();
    formData.set("tagId", "tag1");

    const result = await toggleTagSubscription(
      { success: false, message: "" },
      formData
    );

    expect(result).toEqual({
      success: true,
      message: "Subscribed to tag",
    });
    expect(mockPrisma.tagSubscription.create).toHaveBeenCalledWith({
      data: { userId: "user1", tagId: "tag1" },
    });
  });

  it("deletes subscription when one already exists", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.tagSubscription.findUnique.mockResolvedValueOnce({
      id: "sub1",
    } as never);
    mockPrisma.tagSubscription.delete.mockResolvedValueOnce({} as never);

    const formData = new FormData();
    formData.set("tagId", "tag1");

    const result = await toggleTagSubscription(
      { success: false, message: "" },
      formData
    );

    expect(result).toEqual({
      success: true,
      message: "Unsubscribed from tag",
    });
    expect(mockPrisma.tagSubscription.delete).toHaveBeenCalledWith({
      where: { id: "sub1" },
    });
  });
});

describe("updateTagSubscriptionFrequency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const result = await updateTagSubscriptionFrequency("tag1", "immediate");

    expect(result).toEqual({
      success: false,
      message: "Not authenticated",
    });
  });

  it("returns error for invalid frequency", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    const result = await updateTagSubscriptionFrequency("tag1", "weekly");

    expect(result).toEqual({
      success: false,
      message: "Invalid frequency",
    });
  });

  it("returns error when not subscribed", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.tagSubscription.findUnique.mockResolvedValueOnce(null);

    const result = await updateTagSubscriptionFrequency("tag1", "digest");

    expect(result).toEqual({
      success: false,
      message: "Not subscribed to this tag",
    });
  });

  it("updates frequency to digest", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.tagSubscription.findUnique.mockResolvedValueOnce({
      id: "sub1",
    } as never);
    mockPrisma.tagSubscription.update.mockResolvedValueOnce({} as never);

    const result = await updateTagSubscriptionFrequency("tag1", "digest");

    expect(result).toEqual({
      success: true,
      message: "Frequency set to digest",
    });
    expect(mockPrisma.tagSubscription.update).toHaveBeenCalledWith({
      where: { id: "sub1" },
      data: { frequency: "digest" },
    });
  });

  it("updates frequency to immediate", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.tagSubscription.findUnique.mockResolvedValueOnce({
      id: "sub1",
    } as never);
    mockPrisma.tagSubscription.update.mockResolvedValueOnce({} as never);

    const result = await updateTagSubscriptionFrequency("tag1", "immediate");

    expect(result).toEqual({
      success: true,
      message: "Frequency set to immediate",
    });
  });
});

describe("getTagSubscriptionStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const result = await getTagSubscriptionStatus("art");

    expect(result).toBeNull();
  });

  it("returns null when tag does not exist", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.tag.findUnique.mockResolvedValueOnce(null);

    const result = await getTagSubscriptionStatus("nonexistent");

    expect(result).toBeNull();
  });

  it("returns subscribed false when no subscription exists", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.tag.findUnique.mockResolvedValueOnce({ id: "tag1" } as never);
    mockPrisma.tagSubscription.findUnique.mockResolvedValueOnce(null);

    const result = await getTagSubscriptionStatus("art");

    expect(result).toEqual({
      subscribed: false,
      frequency: "immediate",
      emailNotification: false,
      tagId: "tag1",
    });
  });

  it("returns subscribed true with correct frequency and emailNotification", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.tag.findUnique.mockResolvedValueOnce({ id: "tag1" } as never);
    mockPrisma.tagSubscription.findUnique.mockResolvedValueOnce({
      id: "sub1",
      frequency: "digest",
      emailNotification: true,
    } as never);

    const result = await getTagSubscriptionStatus("art");

    expect(result).toEqual({
      subscribed: true,
      frequency: "digest",
      emailNotification: true,
      tagId: "tag1",
    });
  });
});

describe("updateTagSubscriptionEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const result = await updateTagSubscriptionEmail("tag1", true);

    expect(result).toEqual({
      success: false,
      message: "Not authenticated",
    });
  });

  it("returns error for invalid frequency", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    const result = await updateTagSubscriptionEmail("tag1", true, "weekly");

    expect(result).toEqual({
      success: false,
      message: "Invalid frequency",
    });
  });

  it("returns error when not subscribed", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.tagSubscription.findUnique.mockResolvedValueOnce(null);

    const result = await updateTagSubscriptionEmail("tag1", true);

    expect(result).toEqual({
      success: false,
      message: "Not subscribed to this tag",
    });
  });

  it("enables email notifications", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.tagSubscription.findUnique.mockResolvedValueOnce({
      id: "sub1",
    } as never);
    mockPrisma.tagSubscription.update.mockResolvedValueOnce({} as never);

    const result = await updateTagSubscriptionEmail("tag1", true);

    expect(result).toEqual({
      success: true,
      message: "Email notifications enabled",
    });
    expect(mockPrisma.tagSubscription.update).toHaveBeenCalledWith({
      where: { id: "sub1" },
      data: { emailNotification: true },
    });
  });

  it("disables email notifications", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.tagSubscription.findUnique.mockResolvedValueOnce({
      id: "sub1",
    } as never);
    mockPrisma.tagSubscription.update.mockResolvedValueOnce({} as never);

    const result = await updateTagSubscriptionEmail("tag1", false);

    expect(result).toEqual({
      success: true,
      message: "Email notifications disabled",
    });
    expect(mockPrisma.tagSubscription.update).toHaveBeenCalledWith({
      where: { id: "sub1" },
      data: { emailNotification: false },
    });
  });

  it("enables email notifications with frequency", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.tagSubscription.findUnique.mockResolvedValueOnce({
      id: "sub1",
    } as never);
    mockPrisma.tagSubscription.update.mockResolvedValueOnce({} as never);

    const result = await updateTagSubscriptionEmail("tag1", true, "digest");

    expect(result).toEqual({
      success: true,
      message: "Email notifications enabled",
    });
    expect(mockPrisma.tagSubscription.update).toHaveBeenCalledWith({
      where: { id: "sub1" },
      data: { emailNotification: true, frequency: "digest" },
    });
  });

  it("does not include frequency when not provided", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.tagSubscription.findUnique.mockResolvedValueOnce({
      id: "sub1",
    } as never);
    mockPrisma.tagSubscription.update.mockResolvedValueOnce({} as never);

    await updateTagSubscriptionEmail("tag1", true);

    expect(mockPrisma.tagSubscription.update).toHaveBeenCalledWith({
      where: { id: "sub1" },
      data: { emailNotification: true },
    });
  });
});
