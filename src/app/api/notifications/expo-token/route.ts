import { getSessionFromRequest } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

/**
 * Register or unregister an Expo push token for the authenticated user.
 */
export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return corsJson(req, { error: "Not authenticated" }, { status: 401 });
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const { token } = body;
  if (!token || !token.startsWith("ExponentPushToken[")) {
    return corsJson(req, { error: "Invalid Expo push token" }, { status: 400 });
  }

  // Upsert: create if not exists, update userId if token exists under different user
  await prisma.expoPushToken.upsert({
    where: { token },
    create: {
      userId: session.user.id,
      token,
    },
    update: {
      userId: session.user.id,
    },
  });

  return corsJson(req, { success: true });
}

/**
 * Remove an Expo push token (e.g., on logout).
 */
export async function DELETE(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return corsJson(req, { error: "Not authenticated" }, { status: 401 });
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const { token } = body;
  if (!token) {
    return corsJson(req, { error: "Token required" }, { status: 400 });
  }

  await prisma.expoPushToken.deleteMany({
    where: { token, userId: session.user.id },
  });

  return corsJson(req, { success: true });
}
