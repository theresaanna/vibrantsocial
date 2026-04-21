/**
 * Mobile forgot-password kickoff.
 *
 *   POST /api/v1/auth/forgot-password  { email }
 *     → 200 { ok: true, message }   (success is silent — same response
 *                                    for unknown email, OAuth-only
 *                                    users, or successful enqueue; the
 *                                    server never discloses which)
 *
 * Mirrors `requestPasswordReset()` in `src/app/forgot-password/
 * actions.ts` but drops the Turnstile captcha — mobile can't host one,
 * and the auth rate limiter (30/min/IP) already caps abuse.
 */
import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { authLimiter, isRateLimited } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  // Rate-limit by client IP so the mobile endpoint can't be used to
  // blast password-reset emails at an arbitrary address.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (await isRateLimited(authLimiter, `forgot-password:${ip}`)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: corsHeaders(req) },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders(req) },
    );
  }

  const rawEmail =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).email
      : undefined;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  // Length-cap before the regex: the pattern below has overlapping
  // [^\s@]+ groups that can backtrack polynomially on crafted input,
  // so we bound input size first (RFC 5321 caps addresses at 254).
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email." },
      { status: 400, headers: corsHeaders(req) },
    );
  }

  const successMessage =
    "If an account with that email exists, we sent you a reset link.";

  const user = await prisma.user.findUnique({ where: { email } });

  // Same silent-fail policy as web: unknown email or OAuth-only account
  // still gets a "sent" response so attackers can't enumerate users.
  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { ok: true, message: successMessage },
      { headers: corsHeaders(req) },
    );
  }

  // Drop any stale tokens for this identifier so a user hitting the
  // endpoint twice doesn't accumulate rows.
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  // Fire-and-forget — user shouldn't wait on Resend.
  sendPasswordResetEmail({ toEmail: email, token });

  return NextResponse.json(
    { ok: true, message: successMessage },
    { headers: corsHeaders(req) },
  );
}
