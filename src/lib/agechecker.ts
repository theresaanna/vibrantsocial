import crypto from "crypto";

const API_BASE = "https://api.agechecker.net";

interface AgeCheckerCustomerData {
  first_name: string;
  last_name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  dob_day: number;
  dob_month: number;
  dob_year: number;
  email?: string;
}

interface AgeCheckerCreateOptions {
  min_age?: number;
  customer_ip?: string;
  contact_customer?: boolean;
  callback_url?: string;
  metadata?: Record<string, string>;
}

export type AgeCheckerStatus =
  | "accepted"
  | "denied"
  | "signature"
  | "photo_id"
  | "phone_validation"
  | "pending"
  | "not_created";

export interface AgeCheckerCreateResponse {
  uuid?: string;
  status: AgeCheckerStatus;
  error?: { code: string; message: string };
}

export interface AgeCheckerStatusResponse {
  status: AgeCheckerStatus;
  reason?: string;
}

export interface AgeCheckerWebhookPayload {
  uuid: string;
  status: "accepted" | "denied";
  reason?: string;
}

/**
 * Creates a verification request with AgeChecker.net.
 */
export async function createVerification(
  data: AgeCheckerCustomerData,
  options?: AgeCheckerCreateOptions
): Promise<AgeCheckerCreateResponse> {
  const apiKey = process.env.AGECHECKER_API_KEY;
  const secret = process.env.AGECHECKER_SECRET;

  if (!apiKey || !secret) {
    throw new Error("AGECHECKER_API_KEY and AGECHECKER_SECRET must be set");
  }

  const res = await fetch(`${API_BASE}/v1/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: apiKey,
      secret,
      data,
      options: {
        min_age: 18,
        ...options,
      },
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(
      json.error?.message ?? `AgeChecker API error: ${res.status}`
    );
  }

  return json as AgeCheckerCreateResponse;
}

/**
 * Checks the status of a verification request.
 */
export async function getVerificationStatus(
  uuid: string
): Promise<AgeCheckerStatusResponse> {
  const secret = process.env.AGECHECKER_SECRET;
  if (!secret) throw new Error("AGECHECKER_SECRET must be set");

  const res = await fetch(`${API_BASE}/v1/status/${uuid}`, {
    headers: { "X-AgeChecker-Secret": secret },
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(
      json.error?.message ?? `AgeChecker API error: ${res.status}`
    );
  }

  return json as AgeCheckerStatusResponse;
}

/**
 * Verifies the webhook signature from AgeChecker.net.
 * Returns true if the signature is valid.
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const secret = process.env.AGECHECKER_SECRET;
  if (!secret) return false;

  const hash = crypto
    .createHmac("sha1", secret)
    .update(body)
    .digest("base64");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}
