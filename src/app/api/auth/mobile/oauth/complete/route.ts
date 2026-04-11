/**
 * Mobile OAuth completion endpoint.
 *
 * GET /api/auth/mobile/oauth/complete
 *
 * After NextAuth finishes the OAuth flow, the user is redirected here
 * with a valid web session cookie. This endpoint:
 * 1. Reads the session from the cookie
 * 2. Generates a mobile JWT for the authenticated user
 * 3. Redirects to the app's deep link with the token
 *    (or shows the token on a page for web preview debugging)
 */
import { auth } from "@/auth";
import { generateMobileTokenFromSession } from "@/lib/mobile-auth";

const APP_SCHEME = "vibrantsocial";

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return createCallbackResponse(
        null,
        "Authentication failed. Please try again."
      );
    }

    const token = await generateMobileTokenFromSession(session);
    return createCallbackResponse(token, null);
  } catch (error) {
    console.error("[mobile-oauth-complete]", error);
    return createCallbackResponse(null, "An unexpected error occurred.");
  }
}

/**
 * Returns either a deep-link redirect or an HTML page that posts the
 * token back to the opener window (for web preview compatibility).
 */
function createCallbackResponse(token: string | null, error: string | null) {
  const deepLink = token
    ? `${APP_SCHEME}://auth-callback?token=${token}`
    : `${APP_SCHEME}://auth-callback?error=${encodeURIComponent(error || "Unknown error")}`;

  // Return an HTML page that:
  // 1. Tries to post the token to the opener window (web popup flow)
  // 2. Falls back to deep link redirect (native in-app browser flow)
  const html = `<!DOCTYPE html>
<html>
<head><title>VibrantSocial - Completing login...</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#faf5ff">
  <div style="text-align:center">
    <p style="font-size:18px;color:#374151">${token ? "Login successful!" : "Login failed"}</p>
    <p style="color:#6b7280">${token ? "Redirecting back to the app..." : (error || "Unknown error")}</p>
  </div>
  <script>
    (function() {
      var token = ${token ? JSON.stringify(token) : "null"};
      var error = ${error ? JSON.stringify(error) : "null"};

      // Try posting to opener (web popup flow)
      if (window.opener) {
        try {
          window.opener.postMessage(
            { type: "vibrantsocial-oauth", token: token, error: error },
            "*"
          );
          setTimeout(function() { window.close(); }, 500);
          return;
        } catch(e) {}
      }

      // Fall back to deep link (native flow)
      window.location.href = ${JSON.stringify(deepLink)};
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
