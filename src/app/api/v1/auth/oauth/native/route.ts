/**
 * Native mobile OAuth: exchange a provider-issued ID token for a mobile JWT.
 *
 * POST /api/v1/auth/oauth/native
 *   {
 *     provider: "google" | "apple",
 *     idToken: string,
 *     // Apple-only: user details returned by the native SDK on first sign-in
 *     //   — Apple does NOT include these in the ID token itself.
 *     apple?: { givenName?: string; familyName?: string; email?: string }
 *   }
 *
 * Flow:
 *   1. Verify the ID token against the provider's JWKS and expected audience.
 *   2. Find an existing NextAuth-style Account row by (provider, sub); if
 *      missing, match by email and link, or create a fresh User + Account.
 *   3. Issue a mobile JWT in the same shape as /login and /signup return.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { prisma } from "@/lib/prisma";
import { generateMobileToken } from "@/lib/mobile-auth";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { authLimiter, checkRateLimit } from "@/lib/rate-limit";
import { randomBytes } from "node:crypto";

// --- provider configs -------------------------------------------------

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const GOOGLE_ISSUERS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);

const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);
const APPLE_ISSUER = "https://appleid.apple.com";

function googleAudiences(): string[] {
  const ids = [
    process.env.AUTH_GOOGLE_IOS_CLIENT_ID,
    process.env.AUTH_GOOGLE_ANDROID_CLIENT_ID,
    process.env.AUTH_GOOGLE_ID, // the web client id is accepted as a fallback
  ].filter((v): v is string => !!v && v.length > 0);
  return ids;
}

function appleAudiences(): string[] {
  const ids = [
    process.env.AUTH_APPLE_BUNDLE_ID,
    process.env.AUTH_APPLE_SERVICE_ID,
  ].filter((v): v is string => !!v && v.length > 0);
  // Default to the known bundle ID so dev works without extra env setup.
  if (ids.length === 0) ids.push("app.vibrantsocial.app");
  return ids;
}

// --- handlers ---------------------------------------------------------

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimited = await checkRateLimit(authLimiter, `mobile-native-oauth:${ip}`);
  if (rateLimited) return rateLimited;

  let body: {
    provider?: string;
    idToken?: string;
    apple?: { givenName?: string; familyName?: string; email?: string };
  };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const { provider, idToken } = body;
  if (!provider || !idToken) {
    return corsJson(req, { error: "Missing provider or idToken" }, { status: 400 });
  }

  let verified: VerifiedIdentity;
  try {
    if (provider === "google") {
      verified = await verifyGoogle(idToken);
    } else if (provider === "apple") {
      verified = await verifyApple(idToken, body.apple);
    } else {
      return corsJson(req, { error: "Unsupported provider" }, { status: 400 });
    }
  } catch (err) {
    console.error("[oauth-native]", err);
    return corsJson(req, { error: "ID token verification failed" }, { status: 401 });
  }

  if (!verified.email) {
    return corsJson(
      req,
      { error: "Provider did not return an email. Sign in with email+password instead." },
      { status: 400 },
    );
  }

  const user = await findOrCreateUser(verified);
  if (user.suspended) {
    return corsJson(req, { error: "Account suspended" }, { status: 403 });
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

// --- verification -----------------------------------------------------

interface VerifiedIdentity {
  provider: "google" | "apple";
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

async function verifyGoogle(idToken: string): Promise<VerifiedIdentity> {
  const audiences = googleAudiences();
  if (audiences.length === 0) {
    throw new Error("No Google audience configured");
  }
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    audience: audiences,
  });
  if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) {
    throw new Error("Invalid Google issuer");
  }
  return {
    provider: "google",
    sub: requireSub(payload),
    email: (payload.email as string | undefined) ?? null,
    emailVerified: payload.email_verified === true,
    name: (payload.name as string | undefined) ?? null,
    picture: (payload.picture as string | undefined) ?? null,
  };
}

async function verifyApple(
  idToken: string,
  extras?: { givenName?: string; familyName?: string; email?: string },
): Promise<VerifiedIdentity> {
  const audiences = appleAudiences();
  const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
    audience: audiences,
    issuer: APPLE_ISSUER,
  });
  // Apple only includes the email in the ID token on the first sign-in for
  // an app; on subsequent sign-ins, the email claim is absent. The native
  // SDK also surfaces name/email separately on first auth — accept those
  // as `extras` so we can persist them.
  const email =
    (payload.email as string | undefined) ?? extras?.email ?? null;
  const nameParts = [extras?.givenName, extras?.familyName].filter(Boolean);
  const name = nameParts.length ? nameParts.join(" ") : null;
  return {
    provider: "apple",
    sub: requireSub(payload),
    email,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name,
    picture: null,
  };
}

function requireSub(payload: JWTPayload): string {
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("ID token missing sub");
  }
  return payload.sub;
}

// --- user linking -----------------------------------------------------

async function findOrCreateUser(v: VerifiedIdentity) {
  // 1. Existing Account row — same provider + providerAccountId.
  const existingAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: v.provider,
        providerAccountId: v.sub,
      },
    },
    select: { userId: true },
  });
  if (existingAccount) {
    return prisma.user.findUniqueOrThrow({
      where: { id: existingAccount.userId },
      select: userSelect,
    });
  }

  // 2. Existing User by email — link this provider to the account.
  if (v.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: v.email },
      select: userSelect,
    });
    if (byEmail) {
      await prisma.account.create({
        data: {
          userId: byEmail.id,
          type: "oauth",
          provider: v.provider,
          providerAccountId: v.sub,
        },
      });
      return byEmail;
    }
  }

  // 3. Brand new user — generate a unique username and create both rows.
  const username = await generateUniqueUsername(v.email ?? v.name ?? v.provider);
  const created = await prisma.user.create({
    data: {
      email: v.email!,
      username,
      name: v.name ?? username,
      displayName: v.name,
      avatar: v.picture,
      emailVerified: v.emailVerified ? new Date() : null,
      accounts: {
        create: {
          type: "oauth",
          provider: v.provider,
          providerAccountId: v.sub,
        },
      },
    },
    select: userSelect,
  });
  return created;
}

const userSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatar: true,
  tier: true,
  suspended: true,
} as const;

/**
 * Derive a URL-safe username from whatever signal the provider gave us,
 * then suffix a short random token until it's unique. Users can rename
 * from Settings post-signup — this just needs to be valid and distinct.
 */
async function generateUniqueUsername(seed: string): Promise<string> {
  const base =
    seed
      .toLowerCase()
      .split("@")[0]
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20) || "user";
  for (let i = 0; i < 5; i++) {
    const suffix = randomBytes(3).toString("hex"); // 6 chars
    const candidate = `${base}-${suffix}`;
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  // Fall back to a fully-random handle on the vanishingly unlikely path
  // where we keep colliding.
  return `user-${randomBytes(6).toString("hex")}`;
}
