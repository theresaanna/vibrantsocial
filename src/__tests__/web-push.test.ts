import { describe, it, expect, vi, beforeEach } from "vitest";

// Set env vars before module load
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
process.env.VAPID_PRIVATE_KEY = "test-private-key";

const mockSendNotification = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
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

describe("sendPushNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends to all subscriptions for a user", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      { id: "s1", userId: "u1", endpoint: "https://push.example.com/1", p256dh: "key1", auth: "auth1", createdAt: new Date() },
      { id: "s2", userId: "u1", endpoint: "https://push.example.com/2", p256dh: "key2", auth: "auth2", createdAt: new Date() },
    ] as never);
    mockSendNotification.mockResolvedValue({});

    await sendPushNotification("u1", { title: "Test", body: "Hello" });

    expect(mockSendNotification).toHaveBeenCalledTimes(2);
    expect(mockSendNotification).toHaveBeenCalledWith(
      { endpoint: "https://push.example.com/1", keys: { p256dh: "key1", auth: "auth1" } },
      JSON.stringify({ title: "Test", body: "Hello" })
    );
  });

  it("does nothing when user has no subscriptions", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([] as never);

    await sendPushNotification("u1", { title: "Test", body: "Hello" });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("cleans up expired subscriptions (410)", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      { id: "s1", userId: "u1", endpoint: "https://push.example.com/1", p256dh: "key1", auth: "auth1", createdAt: new Date() },
      { id: "s2", userId: "u1", endpoint: "https://push.example.com/2", p256dh: "key2", auth: "auth2", createdAt: new Date() },
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
      { id: "s1", userId: "u1", endpoint: "https://push.example.com/1", p256dh: "key1", auth: "auth1", createdAt: new Date() },
    ] as never);
    mockSendNotification.mockRejectedValueOnce({ statusCode: 404 });
    mockPrisma.pushSubscription.deleteMany.mockResolvedValueOnce({ count: 1 } as never);

    await sendPushNotification("u1", { title: "Test", body: "Hello" });

    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1"] } },
    });
  });

  it("does not delete on non-410/404 errors", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      { id: "s1", userId: "u1", endpoint: "https://push.example.com/1", p256dh: "key1", auth: "auth1", createdAt: new Date() },
    ] as never);
    mockSendNotification.mockRejectedValueOnce({ statusCode: 500 });

    await sendPushNotification("u1", { title: "Test", body: "Hello" });

    expect(mockPrisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });
});
