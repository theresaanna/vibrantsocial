/**
 * Mobile OAuth bridge page.
 *
 * This page is opened by the mobile app in an in-app browser.
 * It auto-submits the OAuth sign-in form to NextAuth, which handles
 * the full OAuth flow. After auth, NextAuth redirects to
 * /api/auth/mobile/oauth/complete, which generates a mobile JWT
 * and deep-links back to the app.
 *
 * Usage: /auth/mobile-oauth?provider=google
 */
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

interface Props {
  searchParams: Promise<{ provider?: string }>;
}

const VALID_PROVIDERS = ["google", "discord"];

export default async function MobileOAuthPage({ searchParams }: Props) {
  const { provider } = await searchParams;

  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui" }}>
        <h1>Invalid Provider</h1>
        <p>Supported providers: Google, Discord</p>
      </div>
    );
  }

  // Use a server action to initiate the OAuth sign-in.
  // This handles CSRF tokens automatically.
  async function startOAuth() {
    "use server";
    await signIn(provider!, {
      redirectTo: "/api/auth/mobile/oauth/complete",
    });
  }

  // Auto-submit the form on page load via JS
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui",
        backgroundColor: "#faf5ff",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#c026d3" strokeWidth="2" />
          <path d="M12 6v6l4 2" stroke="#c026d3" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <p style={{ fontSize: 18, color: "#374151", marginBottom: 16 }}>
        Redirecting to {provider === "google" ? "Google" : "Discord"}...
      </p>
      <form action={startOAuth}>
        <button
          type="submit"
          id="auto-submit"
          style={{
            backgroundColor: "#c026d3",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "12px 32px",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Continue with {provider === "google" ? "Google" : "Discord"}
        </button>
      </form>
      {/* Auto-click the button after page loads */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('auto-submit')?.click();`,
        }}
      />
    </div>
  );
}
