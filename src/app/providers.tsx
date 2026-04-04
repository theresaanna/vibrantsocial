"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { AblyProvider, ChannelProvider, usePresence } from "ably/react";
import { getAblyRealtimeClient } from "@/lib/ably";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ToastProvider } from "@/components/toast-provider";
import { CookieToast } from "@/components/cookie-toast";
import { Toaster } from "sonner";
import { CommentCountProvider } from "@/hooks/use-comment-counts";

const PRESENCE_CHANNEL = "presence:global";

function PresenceEntry() {
  usePresence(PRESENCE_CHANNEL, { status: "online" });
  return null;
}

const AblyReadyContext = createContext(false);

export function useAblyReady() {
  return useContext(AblyReadyContext);
}

// Presence + toast features that mount only when Ably is connected.
// Separate component to avoid conditional hook calls in the parent.
function AblyFeatures() {
  return (
    <ChannelProvider channelName={PRESENCE_CHANNEL}>
      <PresenceEntry />
      <ToastProvider />
    </ChannelProvider>
  );
}

// Get-or-create the Ably client eagerly (without connecting).
// AblyProvider needs a client instance at all times so the provider tree
// stays stable. We only call .connect() once the user session is available.
function getOrCreateClient() {
  return getAblyRealtimeClient(); // autoConnect: false, so this is safe
}

function AblyProviderWrapper({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [ablyClient] = useState(getOrCreateClient);
  const connectedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (session?.user?.id && !connectedRef.current) {
      connectedRef.current = true;
      ablyClient.connect();
      setIsReady(true);
    }
  }, [session?.user?.id, ablyClient]);

  // AblyProvider always wraps children so ably/react hooks work throughout
  // the tree. The provider tree is stable — only the features toggle.
  return (
    <AblyProvider client={ablyClient}>
      <AblyReadyContext.Provider value={isReady}>
        <CommentCountProvider>
          {isReady ? <AblyFeatures /> : <Toaster position="bottom-right" />}
          <CookieToast />
          {children}
        </CommentCountProvider>
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
