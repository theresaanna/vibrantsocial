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

vi.mock("@/lib/email", () => ({
  sendPremiumWelcomeEmail: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { constructWebhookEvent } from "@/lib/stripe";
import { sendPremiumWelcomeEmail } from "@/lib/email";
import { POST } from "@/app/api/stripe/webhook/route";

const mockPrisma = vi.mocked(prisma);
const mockConstructEvent = vi.mocked(constructWebhookEvent);
const mockSendPremiumWelcome = vi.mocked(sendPremiumWelcomeEmail);

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

function makePremiumCheckoutEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_premium_123",
        payment_status: "paid",
        client_reference_id: "user-123",
        customer: "cus_123",
        subscription: "sub_123",
        metadata: { purpose: "premium_subscription", userId: "user-123" },
        ...overrides,
      },
    },
  };
}

function makeInvoiceEvent(
  type: "invoice.payment_succeeded" | "invoice.payment_failed",
  overrides: Record<string, unknown> = {}
) {
  return {
    type,
    data: {
      object: {
        id: "in_test_123",
        customer: "cus_123",
        subscription: "sub_123",
        ...overrides,
      },
    },
  };
}

function makeSubscriptionDeletedEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: "customer.subscription.deleted",
    data: {
      object: {
        id: "sub_123",
        customer: "cus_123",
        ...overrides,
      },
    },
  };
}

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // === Shared webhook validation ===

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

  it("ignores non-checkout event types gracefully", async () => {
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

  // === Age Verification (existing, regression tests) ===

  describe("age verification checkout", () => {
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

      mockPrisma.user.findUnique.mockResolvedValue({
        ageVerificationPaid: null,
      } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);

      const req = makeRequest("{}", "valid-sig");
      await POST(req);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-456" },
        select: { ageVerificationPaid: true },
      });
    });
  });

  // === Premium Subscription Checkout ===

  describe("premium subscription checkout", () => {
    it("activates premium for user on successful subscription checkout", async () => {
      mockConstructEvent.mockReturnValue(makePremiumCheckoutEvent() as never);
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeSubscriptionId: null,
        email: "user@example.com",
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
          tier: "premium",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
          premiumExpiresAt: null,
        },
      });
    });

    it("sends premium welcome email with verification coupon", async () => {
      mockConstructEvent.mockReturnValue(makePremiumCheckoutEvent() as never);
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeSubscriptionId: null,
        email: "user@example.com",
      } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);

      const req = makeRequest("{}", "valid-sig");
      await POST(req);

      expect(mockSendPremiumWelcome).toHaveBeenCalledWith({
        toEmail: "user@example.com",
      });
    });

    it("stores stripeCustomerId and stripeSubscriptionId", async () => {
      mockConstructEvent.mockReturnValue(
        makePremiumCheckoutEvent({
          customer: "cus_custom",
          subscription: "sub_custom",
        }) as never
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeSubscriptionId: null,
      } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);

      const req = makeRequest("{}", "valid-sig");
      await POST(req);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripeCustomerId: "cus_custom",
            stripeSubscriptionId: "sub_custom",
          }),
        })
      );
    });

    it("is idempotent when user already has this subscription", async () => {
      mockConstructEvent.mockReturnValue(makePremiumCheckoutEvent() as never);
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeSubscriptionId: "sub_123",
      } as never);

      const req = makeRequest("{}", "valid-sig");
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("handles missing userId gracefully", async () => {
      mockConstructEvent.mockReturnValue(
        makePremiumCheckoutEvent({
          client_reference_id: null,
          metadata: { purpose: "premium_subscription" },
        }) as never
      );

      const req = makeRequest("{}", "valid-sig");
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("handles unknown user gracefully", async () => {
      mockConstructEvent.mockReturnValue(makePremiumCheckoutEvent() as never);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const req = makeRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("falls back to metadata.userId when client_reference_id is null", async () => {
      mockConstructEvent.mockReturnValue(
        makePremiumCheckoutEvent({
          client_reference_id: null,
          metadata: { purpose: "premium_subscription", userId: "user-789" },
        }) as never
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeSubscriptionId: null,
      } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);

      const req = makeRequest("{}", "valid-sig");
      await POST(req);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-789" },
        select: { stripeSubscriptionId: true, email: true },
      });
    });
  });

  // === Invoice Payment Succeeded ===

  describe("invoice.payment_succeeded", () => {
    it("clears premiumExpiresAt when payment succeeds", async () => {
      mockConstructEvent.mockReturnValue(
        makeInvoiceEvent("invoice.payment_succeeded") as never
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        tier: "premium",
        premiumExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);

      const req = makeRequest("{}", "valid-sig");
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { tier: "premium", premiumExpiresAt: null },
      });
    });

    it("sets tier to premium if it was somehow free", async () => {
      mockConstructEvent.mockReturnValue(
        makeInvoiceEvent("invoice.payment_succeeded") as never
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        tier: "free",
        premiumExpiresAt: null,
      } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);

      const req = makeRequest("{}", "valid-sig");
      await POST(req);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { tier: "premium", premiumExpiresAt: null },
      });
    });

    it("is idempotent when premiumExpiresAt is already null and tier is premium", async () => {
      mockConstructEvent.mockReturnValue(
        makeInvoiceEvent("invoice.payment_succeeded") as never
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        tier: "premium",
        premiumExpiresAt: null,
      } as never);

      const req = makeRequest("{}", "valid-sig");
      await POST(req);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("handles user not found by stripeCustomerId gracefully", async () => {
      mockConstructEvent.mockReturnValue(
        makeInvoiceEvent("invoice.payment_succeeded") as never
      );
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const req = makeRequest("{}", "valid-sig");
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("handles missing customer ID gracefully", async () => {
      mockConstructEvent.mockReturnValue(
        makeInvoiceEvent("invoice.payment_succeeded", {
          customer: null,
        }) as never
      );

      const req = makeRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  // === Invoice Payment Failed ===

  describe("invoice.payment_failed", () => {
    it("sets premiumExpiresAt to 7 days from now", async () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      mockConstructEvent.mockReturnValue(
        makeInvoiceEvent("invoice.payment_failed") as never
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        tier: "premium",
      } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);

      const req = makeRequest("{}", "valid-sig");
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          premiumExpiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
        },
      });

      vi.restoreAllMocks();
    });

    it("does not change tier to free immediately", async () => {
      mockConstructEvent.mockReturnValue(
        makeInvoiceEvent("invoice.payment_failed") as never
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        tier: "premium",
      } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);

      const req = makeRequest("{}", "valid-sig");
      await POST(req);

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty("tier");
    });

    it("does not set grace period for free tier users", async () => {
      mockConstructEvent.mockReturnValue(
        makeInvoiceEvent("invoice.payment_failed") as never
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        tier: "free",
      } as never);

      const req = makeRequest("{}", "valid-sig");
      await POST(req);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("handles user not found gracefully", async () => {
      mockConstructEvent.mockReturnValue(
        makeInvoiceEvent("invoice.payment_failed") as never
      );
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const req = makeRequest("{}", "valid-sig");
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("handles missing customer ID gracefully", async () => {
      mockConstructEvent.mockReturnValue(
        makeInvoiceEvent("invoice.payment_failed", {
          customer: null,
        }) as never
      );

      const req = makeRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  // === Subscription Deleted ===

  describe("customer.subscription.deleted", () => {
    it("sets tier to free and clears subscription fields", async () => {
      mockConstructEvent.mockReturnValue(
        makeSubscriptionDeletedEvent() as never
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
      } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);

      const req = makeRequest("{}", "valid-sig");
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          tier: "free",
          stripeSubscriptionId: null,
          premiumExpiresAt: null,
        },
      });
    });

    it("handles user not found gracefully", async () => {
      mockConstructEvent.mockReturnValue(
        makeSubscriptionDeletedEvent() as never
      );
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const req = makeRequest("{}", "valid-sig");
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("handles missing customer ID gracefully", async () => {
      mockConstructEvent.mockReturnValue(
        makeSubscriptionDeletedEvent({ customer: null }) as never
      );

      const req = makeRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("is idempotent — can be called multiple times safely", async () => {
      mockConstructEvent.mockReturnValue(
        makeSubscriptionDeletedEvent() as never
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
      } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);

      const req1 = makeRequest("{}", "valid-sig");
      await POST(req1);

      const req2 = makeRequest("{}", "valid-sig");
      await POST(req2);

      expect(mockPrisma.user.update).toHaveBeenCalledTimes(2);
      // Both calls set the same values — safe idempotency
    });
  });
});
