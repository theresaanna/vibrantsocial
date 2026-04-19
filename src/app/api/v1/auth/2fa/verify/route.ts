/**
 * Mobile 2FA verification.
 *
 * POST /api/v1/auth/2fa/verify
 *   { pendingToken: string, code: string, mode?: "totp" | "backup" }
 *
 * The login endpoint issues a short-lived pendingToken (5 minutes, signed
 * with the same secret as mobile JWTs but with `purpose: "2fa-pending"`)
 * when a credentialed user has 2FA enabled. This route accepts that token
 * together with a 6-digit TOTP code (or a backup code) and, on success,
 * returns the full mobile session — same `{ token, user }` shape as login.
 */
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import {
  decryptSecret,
  verifyTOTPCode,
  verifyBackupCode,
} from "@/lib/two-factor";
import { generateMobileToken } from "@/lib/mobile-auth";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { authLimiter, checkRateLimit } from "@/lib/rate-limit";

const MOBILE_JWT_ISSUER = "vibrantsocial-mobile";
const PENDING_PURPOSE = "2fa-pending";

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!raw) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be set");
  }
  return new TextEncoder().encode(raw);
}

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimited = await checkRateLimit(authLimiter, `mobile-2fa:${ip}`);
  if (rateLimited) return rateLimited;

  let body: { pendingToken?: string; code?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const { pendingToken, code, mode } = body;
  if (!pendingToken || typeof pendingToken !== "string") {
    return corsJson(req, { error: "Missing pendingToken" }, { status: 400 });
  }
  if (!code || typeof code !== "string") {
    return corsJson(req, { error: "Missing code" }, { status: 400 });
  }

  // Verify the pending token — extracts userId and enforces expiry.
  let userId: string;
  try {
    const { payload } = await jwtVerify(pendingToken, getSecret(), {
      issuer: MOBILE_JWT_ISSUER,
    });
    if (payload.purpose !== PENDING_PURPOSE) {
      return corsJson(req, { error: "Invalid token" }, { status: 401 });
    }
    if (typeof payload.sub !== "string") {
      return corsJson(req, { error: "Invalid token" }, { status: 401 });
    }
    userId = payload.sub;
  } catch {
    return corsJson(
      req,
      { error: "Session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatar: true,
      tier: true,
      suspended: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  });

  if (!user || !user.twoFactorEnabled) {
    return corsJson(
      req,
      { error: "2FA is not configured for this account." },
      { status: 400 },
    );
  }

  if (user.suspended) {
    return corsJson(req, { error: "Account suspended" }, { status: 403 });
  }

  const useBackup = mode === "backup";

  if (useBackup) {
    if (!code.trim()) {
      return corsJson(req, { error: "Enter a backup code." }, { status: 400 });
    }
    const matchIndex = await verifyBackupCode(code.trim(), user.twoFactorBackupCodes);
    if (matchIndex === -1) {
      return corsJson(req, { error: "Invalid backup code." }, { status: 401 });
    }
    // Consume the used backup code.
    const remaining = [...user.twoFactorBackupCodes];
    remaining.splice(matchIndex, 1);
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorBackupCodes: remaining },
    });
  } else {
    if (!/^\d{6}$/.test(code)) {
      return corsJson(
        req,
        { error: "Enter a valid 6-digit code." },
        { status: 400 },
      );
    }
    if (!user.twoFactorSecret) {
      return corsJson(
        req,
        { error: "2FA is not configured for this account." },
        { status: 400 },
      );
    }
    const secret = decryptSecret(user.twoFactorSecret);
    if (!verifyTOTPCode(secret, code)) {
      return corsJson(req, { error: "Invalid code." }, { status: 401 });
    }
  }

  const token = await generateMobileToken(user.id);

  return corsJson(req, {
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar,
      tier: user.tier ?? "free",
    },
  });
}
