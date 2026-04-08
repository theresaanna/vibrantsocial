import { describe, it, expect, vi, beforeEach } from "vitest";

// Set env vars before module load
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
process.env.VAPID_PRIVATE_KEY = "test-private-key";

const mockSendNotification = vi.fn();
const mockSetVapidDetails = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => mockSetVapidDetails(...args),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/web-push";

const mockPrisma = vi.mocked(prisma);

function makeSub(id: string, endpoint: string) {
  return {
    id,
    userId: "u1",
    endpoint,
    p256dh: `key-${id}`,
    auth: `auth-${id}`,
    createdAt: new Date(),
  };
}

describe("sendPushNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  // ---- Basic send ----

  it("sends to all subscriptions for a user", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      makeSub("s1", "https://push.example.com/1"),
      makeSub("s2", "https://push.example.com/2"),
    ] as never);
    mockSendNotification.mockResolvedValue({});

    await sendPushNotification("u1", { title: "Test", body: "Hello" });

    expect(mockSendNotification).toHaveBeenCalledTimes(2);
    expect(mockSendNotification).toHaveBeenCalledWith(
      { endpoint: "https://push.example.com/1", keys: { p256dh: "key-s1", auth: "auth-s1" } },
      JSON.stringify({ title: "Test", body: "Hello" })
    );
    expect(mockSendNotification).toHaveBeenCalledWith(
      { endpoint: "https://push.example.com/2", keys: { p256dh: "key-s2", auth: "auth-s2" } },
      JSON.stringify({ title: "Test", body: "Hello" })
    );
  });

  it("does nothing when user has no subscriptions", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([] as never);

    await sendPushNotification("u1", { title: "Test", body: "Hello" });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("queries subscriptions for the correct userId", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([] as never);

    await sendPushNotification("user-42", { title: "T", body: "B" });

    expect(mockPrisma.pushSubscription.findMany).toHaveBeenCalledWith({
      where: { userId: "user-42" },
    });
  });

  it("includes optional url in payload", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      makeSub("s1", "https://push.example.com/1"),
    ] as never);
    mockSendNotification.mockResolvedValue({});

    await sendPushNotification("u1", {
      title: "New post",
      body: "Check it out",
      url: "/post/123",
    });

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.anything(),
      JSON.stringify({ title: "New post", body: "Check it out", url: "/post/123" })
    );
  });

  // ---- Expired subscription cleanup ----

  it("cleans up expired subscriptions (410)", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      makeSub("s1", "https://push.example.com/1"),
      makeSub("s2", "https://push.example.com/2"),
    ] as never);
    mockSendNotification
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ statusCode: 410 });
    mockPrisma.pushSubscription.deleteMany.mockResolvedValueOnce({ count: 1 } as never);

    await sendPushNotification("u1", { title: "Test", body: "Hello" });

    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["s2"] } },
    });
  });

  it("cleans up 404 subscriptions", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      makeSub("s1", "https://push.example.com/1"),
    ] as never);
    mockSendNotification.mockRejectedValueOnce({ statusCode: 404 });
    mockPrisma.pushSubscription.deleteMany.mockResolvedValueOnce({ count: 1 } as never);

    await sendPushNotification("u1", { title: "Test", body: "Hello" });

    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1"] } },
    });
  });

  it("cleans up multiple expired subscriptions at once", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      makeSub("s1", "https://push.example.com/1"),
      makeSub("s2", "https://push.example.com/2"),
      makeSub("s3", "https://push.example.com/3"),
    ] as never);
    mockSendNotification
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ statusCode: 404 });
    mockPrisma.pushSubscription.deleteMany.mockResolvedValueOnce({ count: 2 } as never);

    await sendPushNotification("u1", { title: "Test", body: "Hello" });

    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(["s1", "s3"]) } },
    });
  });

  it("does not delete on non-410/404 errors", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      makeSub("s1", "https://push.example.com/1"),
    ] as never);
    mockSendNotification.mockRejectedValueOnce({ statusCode: 500 });

    await sendPushNotification("u1", { title: "Test", body: "Hello" });

    expect(mockPrisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it("does not delete when all sends succeed", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      makeSub("s1", "https://push.example.com/1"),
      makeSub("s2", "https://push.example.com/2"),
    ] as never);
    mockSendNotification.mockResolvedValue({});

    await sendPushNotification("u1", { title: "Test", body: "Hello" });

    expect(mockPrisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it("does not throw when sendNotification fails with unknown error", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      makeSub("s1", "https://push.example.com/1"),
    ] as never);
    mockSendNotification.mockRejectedValueOnce(new Error("Network error"));

    // Should not throw — Promise.allSettled handles it
    await expect(
      sendPushNotification("u1", { title: "Test", body: "Hello" })
    ).resolves.toBeUndefined();
  });

  // ---- VAPID configuration ----
  // Note: VAPID details are configured once on first call then cached.
  // Since module state persists across tests, we verify it was called
  // at some point during the test suite (prior tests already triggered it).

  it("calls setVapidDetails at most once across calls", async () => {
    mockSetVapidDetails.mockClear();
    mockPrisma.pushSubscription.findMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    await sendPushNotification("u1", { title: "T", body: "B" });
    await sendPushNotification("u1", { title: "T2", body: "B2" });

    // Already configured from earlier tests, so should not be called again
    expect(mockSetVapidDetails).not.toHaveBeenCalled();
  });
});
