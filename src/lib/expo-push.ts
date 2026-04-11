/**
 * Expo Push Notification utilities for mobile clients.
 *
 * Uses the Expo Push API to deliver notifications to the VibrantSocial
 * mobile app. Works alongside the existing web-push infrastructure.
 */
import { prisma } from "@/lib/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  categoryId?: string;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
}

/**
 * Send push notifications to a user's registered Expo push tokens.
 */
export async function sendExpoPushNotification(
  userId: string,
  payload: {
    title?: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  const tokens = await prisma.expoPushToken.findMany({
    where: { userId },
    select: { token: true },
  });

  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: "default",
  }));

  // Chunk into batches of 100 (Expo API limit)
  const chunks: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(chunk),
      });

      if (res.ok) {
        const { data } = (await res.json()) as { data: ExpoPushTicket[] };

        // Remove invalid tokens
        const invalidTokens: string[] = [];
        data.forEach((ticket, i) => {
          if (
            ticket.status === "error" &&
            ticket.message?.includes("DeviceNotRegistered")
          ) {
            invalidTokens.push(chunk[i].to);
          }
        });

        if (invalidTokens.length > 0) {
          await prisma.expoPushToken.deleteMany({
            where: { token: { in: invalidTokens } },
          });
        }
      }
    } catch (err) {
      console.error("[expo-push] Failed to send:", err);
    }
  }
}
