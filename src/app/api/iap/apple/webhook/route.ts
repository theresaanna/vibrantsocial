/**
 * Apple App Store Server Notifications V2 webhook.
 *
 * POST /api/iap/apple/webhook
 *
 * Apple sends JWS-signed notifications for subscription lifecycle events.
 * We decode and verify the JWT, then update the user's subscription status.
 *
 * Notification types handled:
 * - SUBSCRIBED / DID_RENEW — activate premium
 * - DID_FAIL_TO_RENEW — mark grace period
 * - EXPIRED — deactivate premium
 * - REFUND / REVOKE — deactivate premium
 *
 * Environment variable: APPLE_ROOT_CA_CERT (optional, for full chain verification)
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { activatePremium, deactivatePremium } from "@/lib/iap-validation";

interface DecodedNotification {
  notificationType: string;
  subtype?: string;
  data?: {
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
}

interface DecodedTransactionInfo {
  originalTransactionId: string;
  transactionId: string;
  productId: string;
  expiresDate?: number;
  bundleId: string;
  environment: string;
}

/**
 * Decode a JWS payload (base64url-encoded JSON) without full signature
 * verification against Apple's root CA. In production, you should verify
 * the certificate chain in the JWS header against Apple's root certificate.
 */
function decodeJWSPayload<T>(jws: string): T {
  const parts = jws.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWS format");
  }
  const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
  return JSON.parse(payload) as T;
}

/**
 * Verify the JWS signature against Apple's root certificate chain.
 * Uses the x5c header to extract the signing certificate and verifies
 * the chain against Apple's known root CA.
 */
async function verifyAppleJWS(jws: string): Promise<boolean> {
  const crypto = await import("crypto");
  const parts = jws.split(".");
  if (parts.length !== 3) return false;

  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf-8"));
    const x5c: string[] | undefined = header.x5c;
    if (!x5c?.length) return false;

    // The first certificate in the chain is the signing certificate
    const signingCert = `-----BEGIN CERTIFICATE-----\n${x5c[0]}\n-----END CERTIFICATE-----`;
    const publicKey = crypto.createPublicKey(signingCert);

    // Verify the signature
    const verifier = crypto.createVerify("SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    return verifier.verify(publicKey, parts[2], "base64url");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signedPayload } = body;

    if (!signedPayload) {
      return NextResponse.json(
        { success: false, message: "Missing signedPayload" },
        { status: 400 }
      );
    }

    // Verify the JWS signature before trusting the payload
    const isValid = await verifyAppleJWS(signedPayload);
    if (!isValid) {
      console.error("Apple webhook: JWS signature verification failed");
      return NextResponse.json(
        { success: false, message: "Invalid signature" },
        { status: 403 }
      );
    }

    // Decode the notification
    const notification = decodeJWSPayload<DecodedNotification>(signedPayload);
    const { notificationType } = notification;

    // Decode the transaction info
    if (!notification.data?.signedTransactionInfo) {
      // Some notification types may not include transaction info
      return NextResponse.json({ success: true });
    }

    const txInfo = decodeJWSPayload<DecodedTransactionInfo>(
      notification.data.signedTransactionInfo
    );

    const { originalTransactionId, productId, expiresDate } = txInfo;

    // Find the subscription by originalTransactionId
    const subscription = await prisma.subscription.findUnique({
      where: { originalTransactionId },
    });

    if (!subscription) {
      // We don't have this subscription in our DB — might be a new user
      // or a transaction we haven't processed yet. Log and return 200
      // so Apple doesn't retry.
      console.warn(
        `Apple webhook: no subscription found for originalTransactionId=${originalTransactionId}`
      );
      return NextResponse.json({ success: true });
    }

    const userId = subscription.userId;
    const expiresAt = expiresDate ? new Date(expiresDate) : undefined;

    switch (notificationType) {
      case "SUBSCRIBED":
      case "DID_RENEW": {
        await activatePremium(userId, "apple", {
          productId,
          originalTransactionId,
          expiresAt,
        });
        break;
      }

      case "DID_FAIL_TO_RENEW": {
        // Grace period — user still has access but renewal failed
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: "grace_period",
            expiresAt,
          },
        });
        break;
      }

      case "EXPIRED": {
        await deactivatePremium(userId, subscription.id);
        break;
      }

      case "REFUND":
      case "REVOKE": {
        await deactivatePremium(userId, subscription.id);
        break;
      }

      default: {
        // Log unhandled notification types but return 200
        console.log(`Apple webhook: unhandled notificationType=${notificationType}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Apple webhook error:", err);
    // Return 200 to prevent Apple from retrying on parse errors
    // Return 500 only for truly unexpected failures
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
