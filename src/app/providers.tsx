"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import dynamic from "next/dynamic";

// Re-export so existing imports from "@/app/providers" keep working.
export { useAblyReady } from "@/lib/ably-ready-context";

// Dynamically import the Ably provider so the Ably SDK (~50KB gzipped)
// is code-split and only loaded after initial page render.
const AblyProviderWrapper = dynamic(
  () => import("@/app/ably-provider-wrapper"),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AblyProviderWrapper>{children}</AblyProviderWrapper>
      </ThemeProvider>
    </SessionProvider>
  );
}
