"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { AblyProvider, ChannelProvider, usePresence } from "ably/react";
import { getAblyRealtimeClient } from "@/lib/ably";
import { Toaster } from "sonner";
import { CookieToast } from "@/components/cookie-toast";
import { CommentCountProvider } from "@/hooks/use-comment-counts";
import { ToastProvider } from "@/components/toast-provider";
import { AblyReadyContext } from "@/lib/ably-ready-context";

// Re-export so existing imports from "@/app/providers" keep working.
export { useAblyReady } from "@/lib/ably-ready-context";

const PRESENCE_CHANNEL = "presence:global";

function PresenceEntry() {
  usePresence(PRESENCE_CHANNEL, { status: "online" });
  return null;
}

function AblyFeatures() {
  return (
    <>
      <PresenceEntry />
      <ToastProvider />
    </>
  );
}

/**
 * Manages the Ably realtime connection for authenticated users.
 *
 * The child tree is always rendered inside a **stable** wrapper
 * (`AblyProvider → AblyReadyContext → Toaster → CookieToast →
 * CommentCountProvider`) so that no remounts occur when the connection
 * status changes.  For logged-out visitors Ably stays disconnected and
 * `useAblyReady()` returns false.
 */
function AblyProviderWrapper({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [ablyClient] = useState(() => getAblyRealtimeClient());
  const [isReady, setIsReady] = useState(false);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (
      !connectedRef.current &&
      status !== "loading" &&
      session?.user?.id
    ) {
      connectedRef.current = true;
      ablyClient.connect();
      setIsReady(true);
    }
  }, [ablyClient, session?.user?.id, status]);

  return (
    <AblyProvider client={ablyClient}>
      <AblyReadyContext.Provider value={isReady}>
        <ChannelProvider channelName={PRESENCE_CHANNEL}>
          {isReady ? <AblyFeatures /> : <Toaster position="bottom-right" />}
          <CookieToast />
          <CommentCountProvider>{children}</CommentCountProvider>
        </ChannelProvider>
      </AblyReadyContext.Provider>
    </AblyProvider>
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
