/**
 * Mobile OAuth initiation endpoint.
 *
 * GET /api/auth/mobile/oauth?provider=google|discord
 *
 * If the user already has a valid web session (cookie), skip OAuth entirely
 * and generate a mobile JWT immediately. Otherwise, initiate the OAuth flow.
 *
 * Supports two response modes via `Accept` header or `format` query param:
 * - format=json → returns { token } as JSON (for direct fetch from mobile web)
 * - default → returns HTML page with postMessage + deep link fallback
 */
import { cookies } from "next/headers";
import { auth, signIn } from "@/auth";
import { generateMobileTokenFromSession } from "@/lib/mobile-auth";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";

const APP_SCHEME = "vibrantsocial";
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "https://vibrantsocial.app";
const VALID_PROVIDERS = ["google", "discord"] as const;

/** Origins allowed to receive tokens via postMessage. */
const ALLOWED_CALLER_ORIGINS = new Set([
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "https://vibrantsocial.app",
]);

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");
    const format = url.searchParams.get("format");
    const callerOrigin = url.searchParams.get("caller_origin");
    const wantJson =
      format === "json" ||
      req.headers.get("accept")?.includes("application/json");

    if (!provider || !VALID_PROVIDERS.includes(provider as (typeof VALID_PROVIDERS)[number])) {
      return Response.json(
        { error: "Invalid provider. Use 'google' or 'discord'." },
        { status: 400, headers: corsHeaders(req) }
      );
    }

    // Store the caller origin so the completion page can postMessage back
    if (callerOrigin && ALLOWED_CALLER_ORIGINS.has(callerOrigin)) {
      const cookieStore = await cookies();
      cookieStore.set("mobile_oauth_caller_origin", callerOrigin, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600, // 10 minutes — enough for the OAuth flow
        path: "/api/auth/mobile/oauth",
      });
    }

    // Check if user already has a web session — skip OAuth if so.
    const session = await auth();
    if (session?.user?.id) {
      const token = await generateMobileTokenFromSession(session);

      if (wantJson) {
        return Response.json({ token }, { headers: corsHeaders(req) });
      }
      const postMessageOrigin = callerOrigin && ALLOWED_CALLER_ORIGINS.has(callerOrigin)
        ? callerOrigin
        : APP_ORIGIN;
      return createTokenResponse(token, null, postMessageOrigin);
    }

    if (wantJson) {
      // Can't start OAuth via JSON — return instruction to use popup flow
      return Response.json(
        { error: "no_session", message: "No active session. Use popup flow." },
        { status: 401, headers: corsHeaders(req) }
      );
    }

    // No session — start fresh OAuth flow.
    await signIn(provider, {
      redirectTo: "/api/auth/mobile/oauth/complete",
    });
  } catch (error) {
    // signIn() throws a redirect (NEXT_REDIRECT) which must be re-thrown
    if ((error as any)?.digest?.startsWith?.("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("[mobile-oauth]", error);
    return createTokenResponse(null, "Server error during OAuth");
  }
}

/**
 * Return an HTML page that delivers the token.
 * - Posts to opener via postMessage (web popup flow)
 * - Falls back to deep link redirect (native in-app browser flow)
 */
function createTokenResponse(token: string | null, error: string | null, postMessageOrigin: string = APP_ORIGIN) {
  const deepLink = token
    ? `${APP_SCHEME}://auth-callback?token=${token}`
    : `${APP_SCHEME}://auth-callback?error=${encodeURIComponent(error || "Unknown error")}`;

  const html = `<!DOCTYPE html>
<html>
<head><title>VibrantSocial</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#faf5ff">
  <div style="text-align:center">
    <p style="font-size:18px;color:#374151">${token ? "Login successful!" : "Login failed"}</p>
    <p id="status" style="color:#6b7280">${token ? "Returning to the app..." : (error || "Unknown error")}</p>
  </div>
  <script>
    (function() {
      var token = ${token ? JSON.stringify(token) : "null"};
      var error = ${error ? JSON.stringify(error) : "null"};
      var status = document.getElementById("status");

      // Method 1: postMessage to opener (web popup flow)
      if (window.opener) {
        try {
          window.opener.postMessage(
            { type: "vibrantsocial-oauth", token: token, error: error },
            ${JSON.stringify(postMessageOrigin)}
          );
          status.textContent = "Token sent, closing...";
          setTimeout(function() { window.close(); }, 1000);
          return;
        } catch(e) {}
      }

      // Method 2: deep link (native in-app browser flow)
      window.location.href = ${JSON.stringify(deepLink)};
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
