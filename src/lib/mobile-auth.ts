/**
 * Mobile authentication utilities.
 *
 * Provides JWT generation/verification for mobile clients, and a
 * `getSessionFromRequest()` helper that API routes can use to support
 * both cookie-based web sessions AND bearer-token mobile sessions.
 */
import { SignJWT, jwtVerify } from "jose";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

// Use the NextAuth secret for signing mobile JWTs so tokens are compatible.
const rawSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
if (!rawSecret) {
  throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be set for mobile JWT signing");
}
const JWT_SECRET = new TextEncoder().encode(rawSecret);

const MOBILE_JWT_ISSUER = "vibrantsocial-mobile";
const MOBILE_JWT_EXPIRY = "30d";

// ── Token payload ────────────────────────────────────────────────────

export interface MobileTokenPayload {
  sub: string; // user ID
  username: string | null;
  displayName: string | null;
  email: string;
  avatar: string | null;
  tier: string;
  profileFrameId: string | null;
  usernameFont: string | null;
}

// ── Generate a mobile JWT ────────────────────────────────────────────

export async function generateMobileToken(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      avatar: true,
      tier: true,
      profileFrameId: true,
      usernameFont: true,
    },
  });

  return signMobileJwt({
    sub: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email!,
    avatar: user.avatar,
    tier: user.tier ?? "free",
    profileFrameId: user.profileFrameId,
    usernameFont: user.usernameFont,
  });
}

/**
 * Generate a mobile JWT directly from session data, without a Prisma query.
 * Useful when the caller already has a validated session.
 */
export async function generateMobileTokenFromSession(session: Session): Promise<string> {
  const user = session.user;
  return signMobileJwt({
    sub: user.id!,
    username: (user as any).username ?? null,
    displayName: (user as any).displayName ?? user.name ?? null,
    email: user.email!,
    avatar: (user as any).avatar ?? user.image ?? null,
    tier: (user as any).tier ?? "free",
    profileFrameId: (user as any).profileFrameId ?? null,
    usernameFont: (user as any).usernameFont ?? null,
  });
}

/** Internal helper to sign a mobile JWT from a payload. */
function signMobileJwt(payload: MobileTokenPayload): Promise<string> {
  return new SignJWT({ ...payload } as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(MOBILE_JWT_ISSUER)
    .setExpirationTime(MOBILE_JWT_EXPIRY)
    .sign(JWT_SECRET);
}

// ── Verify a mobile JWT ──────────────────────────────────────────────

export async function verifyMobileToken(token: string): Promise<MobileTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: MOBILE_JWT_ISSUER,
    });
    return payload as unknown as MobileTokenPayload;
  } catch {
    return null;
  }
}

// ── Unified session helper ───────────────────────────────────────────

/**
 * Get a session from either cookie-based NextAuth session or mobile
 * bearer token. Returns a NextAuth-compatible session shape.
 */
export async function getSessionFromRequest(
  req: Request
): Promise<Session | null> {
  // 1. Try cookie-based session (web)
  const session = await auth();
  if (session?.user?.id) return session;

  // 2. Try bearer token (mobile)
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const payload = await verifyMobileToken(token);
  if (!payload?.sub) return null;

  // Build a NextAuth-compatible session shape
  return {
    user: {
      id: payload.sub,
      username: payload.username,
      displayName: payload.displayName,
      email: payload.email,
      avatar: payload.avatar,
      tier: payload.tier,
      profileFrameId: payload.profileFrameId,
      usernameFont: payload.usernameFont,
      isEmailVerified: true, // mobile tokens are post-auth
      bio: null,
      name: payload.displayName,
      image: payload.avatar,
      authProvider: null,
      linkedAccounts: [],
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  } as Session;
}
