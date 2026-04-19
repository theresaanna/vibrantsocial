/**
 * Mobile native push registration.
 *
 * The Flutter client activates push via the Ably SDK — Ably hands back a
 * stable `deviceId`. The client then POSTs it here so the server can
 * publish notifications targeted at that device via Ably's push API.
 *
 * POST   /api/v1/notifications/mobile-device
 *   { ablyDeviceId: string, platform: "android" | "ios", appVersion?: string }
 * DELETE /api/v1/notifications/mobile-device
 *   { ablyDeviceId: string }   — called on sign-out
 *
 * Both routes require a valid mobile JWT (or web session).
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  let body: { ablyDeviceId?: string; platform?: string; appVersion?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const { ablyDeviceId, platform, appVersion } = body;
  if (!ablyDeviceId || typeof ablyDeviceId !== "string") {
    return corsJson(req, { error: "ablyDeviceId required" }, { status: 400 });
  }
  if (platform !== "android" && platform !== "ios") {
    return corsJson(
      req,
      { error: "platform must be 'android' or 'ios'" },
      { status: 400 },
    );
  }

  // Upsert keyed on the Ably device id — if the device was previously
  // registered to a different user (e.g. sign-out + sign-in as someone
  // else on the same phone), rebind it to the current viewer.
  await prisma.mobileDevice.upsert({
    where: { ablyDeviceId },
    create: {
      userId: viewer.userId,
      ablyDeviceId,
      platform,
      appVersion: appVersion ?? null,
    },
    update: {
      userId: viewer.userId,
      platform,
      appVersion: appVersion ?? null,
      lastSeenAt: new Date(),
    },
  });

  return corsJson(req, { ok: true });
}

export async function DELETE(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  let body: { ablyDeviceId?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const { ablyDeviceId } = body;
  if (!ablyDeviceId || typeof ablyDeviceId !== "string") {
    return corsJson(req, { error: "ablyDeviceId required" }, { status: 400 });
  }

  // Only delete rows owned by the viewer — prevents a hostile client from
  // unregistering someone else's device by guessing its id.
  await prisma.mobileDevice.deleteMany({
    where: { ablyDeviceId, userId: viewer.userId },
  });

  return corsJson(req, { ok: true });
}
