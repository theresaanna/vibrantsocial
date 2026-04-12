import Ably from "ably";
import { apiLimiter, checkRateLimit } from "@/lib/rate-limit";
import { corsJson, handleCorsPreflightRequest, withCors } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { NextResponse } from "next/server";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(req: Request) {
  // Support both cookie-based (web) and Bearer token (mobile) auth
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return corsJson(req, { error: "Not authenticated" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(apiLimiter, session.user.id);
  if (rateLimited) return withCors(req, rateLimited as NextResponse);

  if (!process.env.ABLY_API_KEY) {
    return corsJson(req, { error: "Realtime not configured" }, { status: 503 });
  }

  const client = new Ably.Rest(process.env.ABLY_API_KEY);
  const tokenRequest = await client.auth.createTokenRequest({
    clientId: session.user.id,
  });

  return corsJson(req, tokenRequest);
}
