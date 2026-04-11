import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateMobileToken } from "@/lib/mobile-auth";
import { loginSchema } from "@vibrantsocial/shared/validations";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return corsJson(req, { error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatar: true,
      tier: true,
      passwordHash: true,
      suspended: true,
      twoFactorEnabled: true,
    },
  });

  if (!user || !user.passwordHash) {
    return corsJson(req, { error: "Invalid email or password" }, { status: 401 });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return corsJson(req, { error: "Invalid email or password" }, { status: 401 });
  }

  if (user.suspended) {
    return corsJson(req, { error: "Account suspended" }, { status: 403 });
  }

  // If 2FA is enabled, return a pending token instead of the full JWT
  if (user.twoFactorEnabled) {
    // Generate a short-lived pending token for 2FA verification
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "");
    const pendingToken = await new SignJWT({ sub: user.id, purpose: "2fa-pending" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(secret);

    return corsJson(req, { requires2fa: true, pendingToken });
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
