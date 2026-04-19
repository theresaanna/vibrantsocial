import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateMobileToken } from "@/lib/mobile-auth";
import { signupSchema } from "@vibrantsocial/shared/validations";
import { autoFriendNewUser } from "@/lib/auto-friend";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { authLimiter, checkRateLimit } from "@/lib/rate-limit";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimited = await checkRateLimit(authLimiter, `mobile-signup:${ip}`);
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return corsJson(req, { error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { email, username, password, dateOfBirth } = parsed.data;

  // Check existing user
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });

  if (existing?.email === email) {
    return corsJson(req, { error: "Email already registered" }, { status: 409 });
  }
  if (existing?.username === username) {
    return corsJson(req, { error: "Username already taken" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      dateOfBirth: new Date(dateOfBirth),
      name: username,
    },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatar: true,
      tier: true,
    },
  });

  // Auto-friend new user (background, non-blocking)
  autoFriendNewUser(user.id).catch(() => {});

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
