import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCreate = vi.fn();
const mockPortalCreate = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: mockCreate,
          retrieve: vi.fn(),
        },
      },
      billingPortal: {
        sessions: {
          create: mockPortalCreate,
        },
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    })),
  };
});

// Must import after mock
import {
  createPremiumCheckoutSession,
  createBillingPortalSession,
  createCheckoutSession,
} from "@/lib/stripe";

describe("createPremiumCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_PREMIUM_PRICE_ID = "price_premium_123";
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PREMIUM_PRICE_ID;
  });

  it("creates session with mode subscription", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/sub" });

    await createPremiumCheckoutSession({
      userId: "user-1",
      userEmail: "test@example.com",
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
      })
    );
  });

  it("uses STRIPE_PREMIUM_PRICE_ID not STRIPE_PRICE_ID", async () => {
    process.env.STRIPE_PRICE_ID = "price_age_verify";
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/sub" });

    await createPremiumCheckoutSession({
      userId: "user-1",
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_premium_123", quantity: 1 }],
      })
    );

    delete process.env.STRIPE_PRICE_ID;
  });

  it("sets metadata.purpose to premium_subscription", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/sub" });

    await createPremiumCheckoutSession({
      userId: "user-1",
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { userId: "user-1", purpose: "premium_subscription" },
      })
    );
  });

  it("passes customer when stripeCustomerId is provided", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/sub" });

    await createPremiumCheckoutSession({
      userId: "user-1",
      stripeCustomerId: "cus_existing",
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
      })
    );
  });

  it("passes customer_email when stripeCustomerId is not provided", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/sub" });

    await createPremiumCheckoutSession({
      userId: "user-1",
      userEmail: "test@example.com",
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: "test@example.com",
      })
    );
    expect(mockCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        customer: expect.anything(),
      })
    );
  });

  it("throws when STRIPE_PREMIUM_PRICE_ID is not set", async () => {
    delete process.env.STRIPE_PREMIUM_PRICE_ID;

    await expect(
      createPremiumCheckoutSession({
        userId: "user-1",
        successUrl: "http://localhost/success",
        cancelUrl: "http://localhost/cancel",
      })
    ).rejects.toThrow("STRIPE_PREMIUM_PRICE_ID must be set");
  });

  it("sets client_reference_id to userId", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/sub" });

    await createPremiumCheckoutSession({
      userId: "user-999",
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: "user-999",
      })
    );
  });
});

describe("createBillingPortalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("creates portal session with correct customerId", async () => {
    mockPortalCreate.mockResolvedValueOnce({
      url: "https://billing.stripe.com/session",
    });

    await createBillingPortalSession({
      stripeCustomerId: "cus_123",
      returnUrl: "http://localhost/premium",
    });

    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "http://localhost/premium",
    });
  });

  it("passes returnUrl correctly", async () => {
    mockPortalCreate.mockResolvedValueOnce({
      url: "https://billing.stripe.com/session",
    });

    await createBillingPortalSession({
      stripeCustomerId: "cus_456",
      returnUrl: "http://localhost/account",
    });

    expect(mockPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: "http://localhost/account",
      })
    );
  });

  it("returns the portal session", async () => {
    const mockSession = {
      url: "https://billing.stripe.com/session/abc",
    };
    mockPortalCreate.mockResolvedValueOnce(mockSession);

    const result = await createBillingPortalSession({
      stripeCustomerId: "cus_123",
      returnUrl: "http://localhost/premium",
    });

    expect(result).toEqual(mockSession);
  });
});

describe("createCheckoutSession (age verification, regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_PRICE_ID = "price_age_123";
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID;
  });

  it("still uses payment mode for age verification", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/pay" });

    await createCheckoutSession({
      userId: "user-1",
      userEmail: "test@example.com",
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        metadata: { userId: "user-1", purpose: "age_verification" },
      })
    );
  });

  it("uses STRIPE_PRICE_ID for age verification", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/pay" });

    await createCheckoutSession({
      userId: "user-1",
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_age_123", quantity: 1 }],
      })
    );
  });
});
