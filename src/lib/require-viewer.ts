import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";

export type RequireViewerResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Pull the authenticated user's id off a request or return a ready-to-
 * send 401 response. Shared by every mobile mutation route so we get
 * consistent error shape + CORS headers.
 */
export async function requireViewer(req: Request): Promise<RequireViewerResult> {
  const session = await getSessionFromRequest(req);
  const userId = session?.user?.id;
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not authenticated" },
        { status: 401, headers: corsHeaders(req) },
      ),
    };
  }
  return { ok: true, userId };
}
