import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { PUT } from "@/app/api/agechecker-webhook/route";

const mockPrisma = vi.mocked(prisma);
const TEST_SECRET = "webhook_test_secret";

function makeSignature(body: string): string {
  return crypto
    .createHmac("sha1", TEST_SECRET)
    .update(body)
    .digest("base64");
}

function makeRequest(body: string, signature?: string): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (signature) {
    headers.set("X-AgeChecker-Signature", signature);
  }
  return new Request("https://example.com/api/agechecker-webhook", {
    method: "PUT",
    headers,
    body,
  });
}

describe("AgeChecker webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AGECHECKER_SECRET = TEST_SECRET;
  });

  it("rejects requests without signature header", async () => {
    const body = JSON.stringify({ uuid: "ver_123", status: "accepted" });
    const req = makeRequest(body);

    const response = await PUT(req as never);
    expect(response.status).toBe(401);

    const json = await response.json();
    expect(json.error).toBe("Missing signature");
  });

  it("rejects requests with invalid signature", async () => {
    const body = JSON.stringify({ uuid: "ver_123", status: "accepted" });
    const req = makeRequest(body, "bad_signature");

    const response = await PUT(req as never);
    expect(response.status).toBe(401);

    const json = await response.json();
    expect(json.error).toBe("Invalid signature");
  });

  it("rejects invalid JSON", async () => {
    const body = "not-json";
    const sig = makeSignature(body);
    const req = makeRequest(body, sig);

    const response = await PUT(req as never);
    expect(response.status).toBe(400);
  });

  it("rejects requests missing uuid or status", async () => {
    const body = JSON.stringify({ uuid: "ver_123" }); // missing status
    const sig = makeSignature(body);
    const req = makeRequest(body, sig);

    const response = await PUT(req as never);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe("Missing uuid or status");
  });

  it("handles accepted status — marks user as age verified", async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: "user1",
      ageVerified: null,
    } as never);

    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const body = JSON.stringify({
      uuid: "ver_accepted",
      status: "accepted",
    });
    const sig = makeSignature(body);
    const req = makeRequest(body, sig);

    const response = await PUT(req as never);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.received).toBe(true);

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { ageVerificationUuid: "ver_accepted" },
      select: { id: true, ageVerified: true },
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { ageVerified: expect.any(Date) },
    });
  });

  it("does not re-verify already verified user", async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: "user1",
      ageVerified: new Date("2025-01-01"),
    } as never);

    const body = JSON.stringify({
      uuid: "ver_dup",
      status: "accepted",
    });
    const sig = makeSignature(body);
    const req = makeRequest(body, sig);

    const response = await PUT(req as never);
    expect(response.status).toBe(200);

    // Should NOT call update since user is already verified
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("handles denied status — does not update user", async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: "user1",
      ageVerified: null,
    } as never);

    const body = JSON.stringify({
      uuid: "ver_denied",
      status: "denied",
      reason: "underage",
    });
    const sig = makeSignature(body);
    const req = makeRequest(body, sig);

    const response = await PUT(req as never);
    expect(response.status).toBe(200);

    // Should NOT mark user as verified on denial
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("handles unknown UUID gracefully", async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    const body = JSON.stringify({
      uuid: "ver_unknown",
      status: "accepted",
    });
    const sig = makeSignature(body);
    const req = makeRequest(body, sig);

    const response = await PUT(req as never);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.received).toBe(true);

    // Should not attempt to update
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
