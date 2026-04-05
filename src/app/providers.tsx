"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { CookieToast } from "@/components/cookie-toast";
import { CommentCountProvider } from "@/hooks/use-comment-counts";
import { AblyReadyContext } from "@/lib/ably-ready-context";

// Re-export so existing imports from "@/app/providers" keep working.
export { useAblyReady } from "@/lib/ably-ready-context";

// Lazily import the Ably wrapper so the Ably SDK (~50KB gzipped)
// is code-split. It only loads once the user has a session.
const LazyAblyInner = lazy(() => import("@/app/ably-provider-wrapper"));

/**
 * Wrapper that renders the full Ably provider tree only for authenticated
 * users, deferring the Ably SDK bundle load. For logged-out visitors,
 * children render immediately without any Ably overhead.
 */
function AblyProviderWrapper({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [shouldLoadAbly, setShouldLoadAbly] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    // Only load Ably once we know the user is authenticated
    if (!checkedRef.current && status !== "loading" && session?.user?.id) {
      checkedRef.current = true;
      setShouldLoadAbly(true);
    }
  }, [session?.user?.id, status]);

  if (shouldLoadAbly) {
    return (
      <Suspense
        fallback={
          <>
            <Toaster position="bottom-right" />
            <CookieToast />
            <CommentCountProvider>{children}</CommentCountProvider>
          </>
        }
      >
        <LazyAblyInner>{children}</LazyAblyInner>
      </Suspense>
    );
  }

  // Logged-out or still loading session — render children without Ably
  return (
    <AblyReadyContext.Provider value={false}>
      <Toaster position="bottom-right" />
      <CookieToast />
      <CommentCountProvider>{children}</CommentCountProvider>
    </AblyReadyContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AblyProviderWrapper>{children}</AblyProviderWrapper>
      </ThemeProvider>
    </SessionProvider>
  );
}
