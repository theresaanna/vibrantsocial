/**
 * Server-side IAP validation utilities for Apple IAP and Google Play Billing.
 *
 * Environment variables required:
 * - APPLE_SHARED_SECRET — Apple App Store shared secret for receipt validation
 * - GOOGLE_SERVICE_ACCOUNT_JSON — Google Cloud service account JSON (stringified)
 *   with access to the Google Play Developer API
 * - GOOGLE_PLAY_PACKAGE_NAME — Android package name (default: com.vibrantsocial.app)
 */
import { prisma } from "@/lib/prisma";

// ── Apple Receipt Validation ─────────────────────────────────────────

const APPLE_PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

interface AppleReceiptResponse {
  status: number;
  environment?: string;
  latest_receipt_info?: Array<{
    product_id: string;
    transaction_id: string;
    original_transaction_id: string;
    expires_date_ms: string;
    is_trial_period?: string;
  }>;
}

/**
 * Validate an Apple receipt with Apple's verifyReceipt endpoint.
 * Automatically retries against sandbox if production returns status 21007.
 */
export async function validateAppleReceipt(receiptData: string): Promise<{
  valid: boolean;
  originalTransactionId?: string;
  productId?: string;
  expiresAt?: Date;
  environment?: string;
}> {
  const payload = {
    "receipt-data": receiptData,
    password: process.env.APPLE_SHARED_SECRET || "",
    "exclude-old-transactions": true,
  };

  // Try production first
  let response = await fetch(APPLE_PRODUCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data: AppleReceiptResponse = await response.json();

  // Status 21007 means this receipt is from the sandbox environment
  if (data.status === 21007) {
    response = await fetch(APPLE_SANDBOX_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    data = await response.json();
  }

  if (data.status !== 0 || !data.latest_receipt_info?.length) {
    return { valid: false };
  }

  // Get the latest transaction (sorted by expiry)
  const sorted = [...data.latest_receipt_info].sort(
    (a, b) => Number(b.expires_date_ms) - Number(a.expires_date_ms)
  );
  const latest = sorted[0];

  const expiresAt = new Date(Number(latest.expires_date_ms));
  const isActive = expiresAt > new Date();

  return {
    valid: isActive,
    originalTransactionId: latest.original_transaction_id,
    productId: latest.product_id,
    expiresAt,
    environment: data.environment,
  };
}

// ── Google Play Validation ───────────────────────────────────────────

interface GoogleSubscriptionResponse {
  expiryTimeMillis?: string;
  paymentState?: number;
  cancelReason?: number;
  orderId?: string;
  linkedPurchaseToken?: string;
}

/**
 * Get an access token for the Google Play Developer API using a service account.
 */
async function getGoogleAccessToken(): Promise<string> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  // Build JWT for Google OAuth2
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url");

  const claimSet = Buffer.from(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  // Sign with the service account private key
  const crypto = await import("crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${claimSet}`);
  const signature = sign.sign(serviceAccount.private_key, "base64url");

  const jwt = `${header}.${claimSet}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error("Failed to obtain Google access token");
  }

  return tokenData.access_token;
}

/**
 * Validate a Google Play subscription purchase.
 */
export async function validateGooglePurchase(
  purchaseToken: string,
  productId: string
): Promise<{
  valid: boolean;
  orderId?: string;
  expiresAt?: Date;
}> {
  const packageName =
    process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.vibrantsocial.app";

  const accessToken = await getGoogleAccessToken();

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${purchaseToken}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error("Google Play validation failed:", response.status);
    return { valid: false };
  }

  const data: GoogleSubscriptionResponse = await response.json();

  if (!data.expiryTimeMillis) {
    return { valid: false };
  }

  const expiresAt = new Date(Number(data.expiryTimeMillis));
  const isActive = expiresAt > new Date();

  return {
    valid: isActive,
    orderId: data.orderId,
    expiresAt,
  };
}

// ── Shared tier management ───────────────────────────────────────────

/**
 * Activate premium for a user and create/update the Subscription record.
 */
export async function activatePremium(
  userId: string,
  platform: "apple" | "google" | "stripe",
  opts: {
    productId: string;
    originalTransactionId?: string;
    purchaseToken?: string;
    expiresAt?: Date;
  }
): Promise<void> {
  const uniqueField =
    platform === "apple"
      ? { originalTransactionId: opts.originalTransactionId! }
      : platform === "google"
        ? { purchaseToken: opts.purchaseToken! }
        : {};

  // Upsert the subscription record
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      platform,
      status: { in: ["active", "grace_period"] },
    },
  });

  if (existingSubscription) {
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        productId: opts.productId,
        status: "active",
        expiresAt: opts.expiresAt,
        ...uniqueField,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId,
        platform,
        productId: opts.productId,
        status: "active",
        expiresAt: opts.expiresAt,
        ...uniqueField,
      },
    });
  }

  // Update user tier
  await prisma.user.update({
    where: { id: userId },
    data: {
      tier: "premium",
      premiumExpiresAt: opts.expiresAt,
    },
  });
}

/**
 * Deactivate premium for a user. Marks the subscription as expired
 * and sets the user tier back to "free".
 */
export async function deactivatePremium(
  userId: string,
  subscriptionId?: string
): Promise<void> {
  if (subscriptionId) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: "expired" },
    });
  } else {
    // Expire all active subscriptions for the user
    await prisma.subscription.updateMany({
      where: {
        userId,
        status: { in: ["active", "grace_period"] },
      },
      data: { status: "expired" },
    });
  }

  // Only downgrade if user has no other active subscriptions
  const remaining = await prisma.subscription.count({
    where: {
      userId,
      status: { in: ["active", "grace_period"] },
    },
  });

  if (remaining === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        tier: "free",
        premiumExpiresAt: null,
      },
    });
  }
}
