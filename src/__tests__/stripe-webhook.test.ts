import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  constructWebhookEvent: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { constructWebhookEvent } from "@/lib/stripe";
import { POST } from "@/app/api/stripe/webhook/route";

const mockPrisma = vi.mocked(prisma);
const mockConstructEvent = vi.mocked(constructWebhookEvent);

function makeRequest(body: string, signature?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (signature) headers["stripe-signature"] = signature;
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers,
  });
}

function makeCheckoutEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        payment_status: "paid",
        client_reference_id: "user-123",
        metadata: { purpose: "age_verification", userId: "user-123" },
        ...overrides,
      },
    },
  };
}

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without stripe-signature header", async () => {
    const req = makeRequest("{}");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/missing stripe-signature/i);
  });

  it("rejects requests with invalid signature", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const req = makeRequest("{}", "bad-sig");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/invalid signature/i);
  });

  it("marks user as paid on checkout.session.completed", async () => {
    mockConstructEvent.mockReturnValue(makeCheckoutEvent() as never);
    mockPrisma.user.findUnique.mockResolvedValue({
      ageVerificationPaid: null,
    } as never);
    mockPrisma.user.update.mockResolvedValue({} as never);

    const req = makeRequest("{}", "valid-sig");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: {
        ageVerificationPaid: expect.any(Date),
        stripeCheckoutSessionId: "cs_test_123",
      },
    });
  });

  it("ignores events without age_verification purpose", async () => {
    mockConstructEvent.mockReturnValue(
      makeCheckoutEvent({
        metadata: { purpose: "something_else" },
      }) as never
    );

    const req = makeRequest("{}", "valid-sig");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("handles duplicate webhooks idempotently", async () => {
    mockConstructEvent.mockReturnValue(makeCheckoutEvent() as never);
    mockPrisma.user.findUnique.mockResolvedValue({
      ageVerificationPaid: new Date(),
    } as never);

    const req = makeRequest("{}", "valid-sig");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("handles unknown user gracefully", async () => {
    mockConstructEvent.mockReturnValue(makeCheckoutEvent() as never);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const req = makeRequest("{}", "valid-sig");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("ignores non-checkout event types", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: {} },
    } as never);

    const req = makeRequest("{}", "valid-sig");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("handles missing client_reference_id gracefully", async () => {
    mockConstructEvent.mockReturnValue(
      makeCheckoutEvent({
        client_reference_id: null,
        metadata: { purpose: "age_verification" },
      }) as never
    );

    const req = makeRequest("{}", "valid-sig");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to metadata.userId when client_reference_id is missing", async () => {
    mockConstructEvent.mockReturnValue(
      makeCheckoutEvent({
        client_reference_id: null,
        metadata: { purpose: "age_verification", userId: "user-456" },
      }) as never
    );

    // The userId from metadata is "user-456" but client_reference_id is null
    // The code uses: session.client_reference_id ?? session.metadata?.userId
    // null ?? "user-456" = "user-456"
    mockPrisma.user.findUnique.mockResolvedValue({
      ageVerificationPaid: null,
    } as never);
    mockPrisma.user.update.mockResolvedValue({} as never);

    const req = makeRequest("{}", "valid-sig");
    const res = await POST(req);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-456" },
      select: { ageVerificationPaid: true },
    });
  });
});
