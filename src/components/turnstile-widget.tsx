"use client";

import { Turnstile } from "@marsidev/react-turnstile";

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Cloudflare Turnstile widget that renders an invisible CAPTCHA challenge.
 * Stores the token in a hidden input named "cf-turnstile-response".
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured.
 */
export function TurnstileWidget() {
  if (!siteKey) return null;

  return (
    <Turnstile
      siteKey={siteKey}
      options={{ size: "flexible", theme: "auto" }}
    />
  );
}
