/**
 * Google Real-time Developer Notifications (RTDN) webhook.
 *
 * POST /api/iap/google/webhook
 *
 * Google Cloud Pub/Sub sends a push message containing a base64-encoded
 * DeveloperNotification. We decode it and handle subscription lifecycle events.
 *
 * Notification types handled:
 * - SUBSCRIPTION_RECOVERED (1) — reactivate premium
 * - SUBSCRIPTION_RENEWED (2) — renew premium
 * - SUBSCRIPTION_CANCELED (3) — mark cancelled (still active until expiry)
 * - SUBSCRIPTION_PURCHASED (4) — activate premium
 * - SUBSCRIPTION_ON_HOLD (5) — grace period
 * - SUBSCRIPTION_IN_GRACE_PERIOD (6) — grace period
 * - SUBSCRIPTION_RESTARTED (7) — reactivate
 * - SUBSCRIPTION_PRICE_CHANGE_CONFIRMED (8) — no action needed
 * - SUBSCRIPTION_DEFERRED (9) — no action needed
 * - SUBSCRIPTION_PAUSED (10) — mark paused
 * - SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED (11) — no action needed
 * - SUBSCRIPTION_REVOKED (12) — deactivate
 * - SUBSCRIPTION_EXPIRED (13) — deactivate
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  validateGooglePurchase,
  activatePremium,
  deactivatePremium,
} from "@/lib/iap-validation";

interface PubSubMessage {
  message?: {
    data?: string; // base64 encoded
    messageId?: string;
  };
  subscription?: string;
}

interface DeveloperNotification {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: {
    version: string;
    notificationType: number;
    purchaseToken: string;
    subscriptionId: string;
  };
}

// Notification type constants
const SUBSCRIPTION_RECOVERED = 1;
const SUBSCRIPTION_RENEWED = 2;
const SUBSCRIPTION_CANCELED = 3;
const SUBSCRIPTION_PURCHASED = 4;
const SUBSCRIPTION_ON_HOLD = 5;
const SUBSCRIPTION_IN_GRACE_PERIOD = 6;
const SUBSCRIPTION_RESTARTED = 7;
const SUBSCRIPTION_REVOKED = 12;
const SUBSCRIPTION_EXPIRED = 13;

export async function POST(request: NextRequest) {
  try {
    const body: PubSubMessage = await request.json();

    // Decode the Pub/Sub message
    if (!body.message?.data) {
      return NextResponse.json(
        { success: false, message: "Missing message data" },
        { status: 400 }
      );
    }

    const decodedData = Buffer.from(body.message.data, "base64").toString("utf-8");
    const notification: DeveloperNotification = JSON.parse(decodedData);

    const subNotification = notification.subscriptionNotification;
    if (!subNotification) {
      // Not a subscription notification — acknowledge and return
      return NextResponse.json({ success: true });
    }

    const { notificationType, purchaseToken, subscriptionId } = subNotification;

    // Find the subscription by purchase token
    const subscription = await prisma.subscription.findUnique({
      where: { purchaseToken },
    });

    switch (notificationType) {
      case SUBSCRIPTION_PURCHASED:
      case SUBSCRIPTION_RECOVERED:
      case SUBSCRIPTION_RENEWED:
      case SUBSCRIPTION_RESTARTED: {
        // Validate the purchase is still active
        const validation = await validateGooglePurchase(purchaseToken, subscriptionId);

        if (subscription) {
          await activatePremium(subscription.userId, "google", {
            productId: subscriptionId,
            purchaseToken,
            expiresAt: validation.expiresAt,
          });
        } else {
          // New purchase without a matching subscription — this can happen
          // if the webhook arrives before the client-side validation.
          // Log it; the client will create the subscription on next validation.
          console.warn(
            `Google webhook: no subscription found for purchaseToken (type=${notificationType})`
          );
        }
        break;
      }

      case SUBSCRIPTION_CANCELED: {
        // User cancelled but subscription is still active until expiry
        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: "cancelled" },
          });
        }
        break;
      }

      case SUBSCRIPTION_ON_HOLD:
      case SUBSCRIPTION_IN_GRACE_PERIOD: {
        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: "grace_period" },
          });
        }
        break;
      }

      case SUBSCRIPTION_REVOKED:
      case SUBSCRIPTION_EXPIRED: {
        if (subscription) {
          await deactivatePremium(subscription.userId, subscription.id);
        }
        break;
      }

      default: {
        // Other notification types (price change, deferred, paused schedule) — no action
        console.log(`Google webhook: unhandled notificationType=${notificationType}`);
      }
    }

    // Always return 200 to acknowledge the Pub/Sub message
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Google webhook error:", err);
    // Return 200 to prevent Pub/Sub from retrying on parse errors
    // Return 500 only for truly unexpected failures
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
