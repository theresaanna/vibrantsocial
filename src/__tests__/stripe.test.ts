import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSessionsCreate = vi.fn();
const mockSessionsRetrieve = vi.fn();
const mockPortalCreate = vi.fn();
const mockConstructEvent = vi.fn();

vi.mock("stripe", () => {
  const MockStripe = vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockSessionsCreate,
        retrieve: mockSessionsRetrieve,
      },
    },
    billingPortal: {
      sessions: { create: mockPortalCreate },
    },
    webhooks: { constructEvent: mockConstructEvent },
  }));
  return { default: MockStripe };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  // Reset the singleton so each test gets a fresh stripe instance
  vi.resetModules();
});

async function loadModule() {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
  vi.stubEnv("STRIPE_PRICE_ID", "price_age_verify");
  vi.stubEnv("STRIPE_PREMIUM_PRICE_ID", "price_premium");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  return import("@/lib/stripe");
}

// ---------------------------------------------------------------------------
// getStripe
// ---------------------------------------------------------------------------

describe("getStripe", () => {
  it("throws when STRIPE_SECRET_KEY is not set", async () => {
    const mod = await import("@/lib/stripe");
    expect(() => mod.getStripe()).toThrow("STRIPE_SECRET_KEY must be set");
  });

  it("returns a Stripe instance when key is set", async () => {
    const mod = await loadModule();
    const stripe = mod.getStripe();
    expect(stripe).toBeDefined();
    expect(stripe.checkout).toBeDefined();
  });

  it("returns the same instance on subsequent calls (singleton)", async () => {
    const mod = await loadModule();
    const a = mod.getStripe();
    const b = mod.getStripe();
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------

describe("createCheckoutSession", () => {
  it("throws when STRIPE_PRICE_ID is not set", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    const mod = await import("@/lib/stripe");
    await expect(
      mod.createCheckoutSession({
        userId: "user-1",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      })
    ).rejects.toThrow("STRIPE_PRICE_ID must be set");
  });

  it("creates a payment checkout session with correct params", async () => {
    mockSessionsCreate.mockResolvedValue({ id: "cs_123" });
    const mod = await loadModule();

    await mod.createCheckoutSession({
      userId: "user-1",
      userEmail: "test@example.com",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(mockSessionsCreate).toHaveBeenCalledWith({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: "price_age_verify", quantity: 1 }],
      allow_promotion_codes: true,
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
      customer_email: "test@example.com",
      client_reference_id: "user-1",
      metadata: { userId: "user-1", purpose: "age_verification" },
    });
  });

  it("sets customer_email to undefined when userEmail is null", async () => {
    mockSessionsCreate.mockResolvedValue({ id: "cs_123" });
    const mod = await loadModule();

    await mod.createCheckoutSession({
      userId: "user-1",
      userEmail: null,
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer_email: undefined })
    );
  });
});

// ---------------------------------------------------------------------------
// getCheckoutSession
// ---------------------------------------------------------------------------

describe("getCheckoutSession", () => {
  it("retrieves a session by ID", async () => {
    mockSessionsRetrieve.mockResolvedValue({ id: "cs_123", status: "complete" });
    const mod = await loadModule();

    const session = await mod.getCheckoutSession("cs_123");
    expect(mockSessionsRetrieve).toHaveBeenCalledWith("cs_123");
    expect(session.id).toBe("cs_123");
  });
});

// ---------------------------------------------------------------------------
// createPremiumCheckoutSession
// ---------------------------------------------------------------------------

describe("createPremiumCheckoutSession", () => {
  it("throws when STRIPE_PREMIUM_PRICE_ID is not set", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_PRICE_ID", "price_age");
    const mod = await import("@/lib/stripe");
    await expect(
      mod.createPremiumCheckoutSession({
        userId: "user-1",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      })
    ).rejects.toThrow("STRIPE_PREMIUM_PRICE_ID must be set");
  });

  it("creates a subscription session with customer_email when no stripeCustomerId", async () => {
    mockSessionsCreate.mockResolvedValue({ id: "cs_premium" });
    const mod = await loadModule();

    await mod.createPremiumCheckoutSession({
      userId: "user-1",
      userEmail: "test@example.com",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer_email: "test@example.com",
        metadata: { userId: "user-1", purpose: "premium_subscription" },
        line_items: [{ price: "price_premium", quantity: 1 }],
      })
    );
    // Should NOT have a customer field when using customer_email
    expect(mockSessionsCreate.mock.calls[0][0]).not.toHaveProperty("customer");
  });

  it("uses existing stripeCustomerId instead of customer_email", async () => {
    mockSessionsCreate.mockResolvedValue({ id: "cs_premium" });
    const mod = await loadModule();

    await mod.createPremiumCheckoutSession({
      userId: "user-1",
      userEmail: "test@example.com",
      stripeCustomerId: "cus_123",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    const call = mockSessionsCreate.mock.calls[0][0];
    expect(call.customer).toBe("cus_123");
    expect(call).not.toHaveProperty("customer_email");
  });
});

// ---------------------------------------------------------------------------
// createBillingPortalSession
// ---------------------------------------------------------------------------

describe("createBillingPortalSession", () => {
  it("creates a billing portal session with correct params", async () => {
    mockPortalCreate.mockResolvedValue({ url: "https://billing.stripe.com/..." });
    const mod = await loadModule();

    const session = await mod.createBillingPortalSession({
      stripeCustomerId: "cus_123",
      returnUrl: "https://example.com/account",
    });

    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://example.com/account",
    });
    expect(session.url).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// constructWebhookEvent
// ---------------------------------------------------------------------------

describe("constructWebhookEvent", () => {
  it("throws when STRIPE_WEBHOOK_SECRET is not set", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    const mod = await import("@/lib/stripe");
    expect(() => mod.constructWebhookEvent("body", "sig")).toThrow(
      "STRIPE_WEBHOOK_SECRET must be set"
    );
  });

  it("delegates to stripe.webhooks.constructEvent", async () => {
    const fakeEvent = { id: "evt_123", type: "checkout.session.completed" };
    mockConstructEvent.mockReturnValue(fakeEvent);
    const mod = await loadModule();

    const event = mod.constructWebhookEvent("raw-body", "sig_header");
    expect(mockConstructEvent).toHaveBeenCalledWith(
      "raw-body",
      "sig_header",
      "whsec_test"
    );
    expect(event).toEqual(fakeEvent);
  });
});
