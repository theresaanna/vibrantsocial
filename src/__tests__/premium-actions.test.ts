import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  createPremiumCheckoutSession: vi.fn(),
  createBillingPortalSession: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createPremiumCheckoutSession,
  createBillingPortalSession,
} from "@/lib/stripe";
import {
  createPremiumSubscription,
  createBillingPortal,
} from "@/app/premium/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockCreateCheckout = vi.mocked(createPremiumCheckoutSession);
const mockCreatePortal = vi.mocked(createBillingPortalSession);

describe("createPremiumSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await createPremiumSubscription();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error when user is not found", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const result = await createPremiumSubscription();
    expect(result.success).toBe(false);
    expect(result.message).toBe("User not found");
  });

  it("returns error when user is already premium", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "test@example.com",
      tier: "premium",
      stripeCustomerId: "cus_123",
    } as never);

    const result = await createPremiumSubscription();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Already subscribed to premium");
  });

  it("returns checkout URL on success", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "test@example.com",
      tier: "free",
      stripeCustomerId: null,
    } as never);
    mockCreateCheckout.mockResolvedValueOnce({
      url: "https://checkout.stripe.com/abc",
    } as never);

    const result = await createPremiumSubscription();
    expect(result.success).toBe(true);
    expect(result.url).toBe("https://checkout.stripe.com/abc");
  });

  it("passes existing stripeCustomerId to checkout when user has one", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "test@example.com",
      tier: "free",
      stripeCustomerId: "cus_existing",
    } as never);
    mockCreateCheckout.mockResolvedValueOnce({
      url: "https://checkout.stripe.com/abc",
    } as never);

    await createPremiumSubscription();
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCustomerId: "cus_existing",
      })
    );
  });

  it("does not pass stripeCustomerId when user has none", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "test@example.com",
      tier: "free",
      stripeCustomerId: null,
    } as never);
    mockCreateCheckout.mockResolvedValueOnce({
      url: "https://checkout.stripe.com/abc",
    } as never);

    await createPremiumSubscription();
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCustomerId: null,
      })
    );
  });

  it("returns error when createPremiumCheckoutSession throws", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "test@example.com",
      tier: "free",
      stripeCustomerId: null,
    } as never);
    mockCreateCheckout.mockRejectedValueOnce(new Error("Stripe error"));

    const result = await createPremiumSubscription();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Stripe error");
  });

  it("returns error when NEXT_PUBLIC_APP_URL is not set", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "test@example.com",
      tier: "free",
      stripeCustomerId: null,
    } as never);

    const result = await createPremiumSubscription();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Server configuration error");
  });

  it("returns error when checkout URL is null", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      email: "test@example.com",
      tier: "free",
      stripeCustomerId: null,
    } as never);
    mockCreateCheckout.mockResolvedValueOnce({
      url: null,
    } as never);

    const result = await createPremiumSubscription();
    expect(result.success).toBe(true);
    expect(result.url).toBeUndefined();
  });
});

describe("createBillingPortal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await createBillingPortal();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns error when user has no stripeCustomerId", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      stripeCustomerId: null,
    } as never);

    const result = await createBillingPortal();
    expect(result.success).toBe(false);
    expect(result.message).toBe("No active subscription found");
  });

  it("returns error when user is not found", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const result = await createBillingPortal();
    expect(result.success).toBe(false);
    expect(result.message).toBe("No active subscription found");
  });

  it("returns billing portal URL on success", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      stripeCustomerId: "cus_123",
    } as never);
    mockCreatePortal.mockResolvedValueOnce({
      url: "https://billing.stripe.com/session/abc",
    } as never);

    const result = await createBillingPortal();
    expect(result.success).toBe(true);
    expect(result.url).toBe("https://billing.stripe.com/session/abc");
  });

  it("passes correct stripeCustomerId and returnUrl", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      stripeCustomerId: "cus_456",
    } as never);
    mockCreatePortal.mockResolvedValueOnce({
      url: "https://billing.stripe.com/session/def",
    } as never);

    await createBillingPortal();
    expect(mockCreatePortal).toHaveBeenCalledWith({
      stripeCustomerId: "cus_456",
      returnUrl: "http://localhost:3000/premium",
    });
  });

  it("returns error when createBillingPortalSession throws", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      stripeCustomerId: "cus_123",
    } as never);
    mockCreatePortal.mockRejectedValueOnce(new Error("Portal error"));

    const result = await createBillingPortal();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Portal error");
  });

  it("returns error when NEXT_PUBLIC_APP_URL is not set", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      stripeCustomerId: "cus_123",
    } as never);

    const result = await createBillingPortal();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Server configuration error");
  });
});
