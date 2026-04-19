import { NextResponse } from "next/server";

/**
 * Allowed origins for cross-origin requests. Native mobile clients do not
 * send an Origin header so they are unaffected by this list; the list only
 * gates browser-based callers (dev tools, preview environments, etc).
 */
const ALLOWED_ORIGINS = new Set([
  "https://vibrantsocial.app",
  "https://www.vibrantsocial.app",
]);

/**
 * Build CORS headers for the given request origin.
 * Returns the origin if it's in the allow-list, otherwise omits the header.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/**
 * Standard OPTIONS handler for CORS preflight requests.
 * Export this as `OPTIONS` from any route that needs CORS.
 */
export function handleCorsPreflightRequest(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/**
 * Wrap a NextResponse with CORS headers.
 * Use this to add CORS headers to existing responses.
 */
export function withCors(req: Request, response: NextResponse): NextResponse {
  const headers = corsHeaders(req);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Helper: create a JSON response with CORS headers.
 */
export function corsJson(
  req: Request,
  data: unknown,
  init?: { status?: number }
): NextResponse {
  const response = NextResponse.json(data, { status: init?.status });
  return withCors(req, response);
}
