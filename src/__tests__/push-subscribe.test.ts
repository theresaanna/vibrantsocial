import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

describe("POST /api/notifications/push/subscribe", () => {
  beforeEach(() => vi.clearAllMocks());

  async function callSubscribe(body: unknown) {
    const { POST } = await import("@/app/api/notifications/push/subscribe/route");
    return POST(new Request("http://localhost/api/notifications/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
  }

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await callSubscribe({ endpoint: "https://push.example.com", keys: { p256dh: "k1", auth: "a1" } });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid subscription data", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const res = await callSubscribe({ endpoint: "https://push.example.com" });
    expect(res.status).toBe(400);
  });

  it("upserts subscription and returns success", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.pushSubscription.upsert.mockResolvedValueOnce({} as never);

    const res = await callSubscribe({
      endpoint: "https://push.example.com/sub1",
      keys: { p256dh: "publicKey", auth: "authSecret" },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example.com/sub1" },
      create: {
        userId: "u1",
        endpoint: "https://push.example.com/sub1",
        p256dh: "publicKey",
        auth: "authSecret",
      },
      update: {
        userId: "u1",
        p256dh: "publicKey",
        auth: "authSecret",
      },
    });
  });
});

describe("POST /api/notifications/push/unsubscribe", () => {
  beforeEach(() => vi.clearAllMocks());

  async function callUnsubscribe(body: unknown) {
    const { POST } = await import("@/app/api/notifications/push/unsubscribe/route");
    return POST(new Request("http://localhost/api/notifications/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
  }

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await callUnsubscribe({ endpoint: "https://push.example.com" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing endpoint", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const res = await callUnsubscribe({});
    expect(res.status).toBe(400);
  });

  it("deletes subscription and returns success", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPrisma.pushSubscription.deleteMany.mockResolvedValueOnce({ count: 1 } as never);

    const res = await callUnsubscribe({ endpoint: "https://push.example.com/sub1" });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example.com/sub1", userId: "u1" },
    });
  });
});
