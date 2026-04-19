/**
 * Server-side push fan-out via Ably Push.
 *
 * Ably handles the FCM/APNs transport — we register each device's
 * Ably-issued deviceId in the `MobileDevice` table, then call
 * `client.push.admin.publish()` here to deliver a native notification.
 *
 * Falls back to a no-op when `ABLY_API_KEY` is not configured so local
 * dev / CI doesn't fail.
 */
import * as Ably from "ably";
import { prisma } from "@/lib/prisma";

let adminClient: Ably.Rest | null = null;

function getClient(): Ably.Rest | null {
  if (!process.env.ABLY_API_KEY) return null;
  if (!adminClient) adminClient = new Ably.Rest(process.env.ABLY_API_KEY);
  return adminClient;
}

export interface MobilePushPayload {
  title: string;
  body: string;
  /** Arbitrary key/value data delivered with the notification. All values
   * must be strings — FCM/APNs both require string-only data dicts. */
  data?: Record<string, string>;
}

/**
 * Deliver a native push to every device a user has registered. Silently
 * skips when Ably is unconfigured or the user has no devices. Safe to
 * call from inside notification creation hot paths — errors are caught
 * and logged so a failing push never breaks the originating action.
 */
export async function sendMobilePushToUser(
  userId: string,
  payload: MobilePushPayload,
): Promise<void> {
  const client = getClient();
  if (!client) return;

  const devices = await prisma.mobileDevice.findMany({
    where: { userId },
    select: { ablyDeviceId: true },
  });
  if (devices.length === 0) return;

  const notification = {
    title: payload.title,
    body: payload.body,
  };

  // Publish in parallel — one request per device. Ably de-dups at the
  // transport layer so duplicate deliveries aren't a concern here.
  await Promise.all(
    devices.map(async (d: { ablyDeviceId: string }) => {
      try {
        await client.push.admin.publish(
          { deviceId: d.ablyDeviceId },
          {
            notification,
            data: payload.data ?? {},
          },
        );
      } catch (err) {
        // One bad device shouldn't fail the batch. Log and move on.
        console.error("[ably-push] publish failed", {
          deviceId: d.ablyDeviceId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );
}
