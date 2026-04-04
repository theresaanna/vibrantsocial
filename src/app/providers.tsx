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

// Renders Ably-dependent features (presence, toast) only when the client is ready.
// Kept as a separate component to avoid conditional hook calls.
function AblyFeatures({ client }: { client: ReturnType<typeof getAblyRealtimeClient> }) {
  return (
    <AblyProvider client={client}>
      <ChannelProvider channelName={PRESENCE_CHANNEL}>
        <PresenceEntry />
        <ToastProvider />
      </ChannelProvider>
    </AblyProvider>
  );
}

function AblyProviderWrapper({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [ablyClient, setAblyClient] = useState<ReturnType<typeof getAblyRealtimeClient> | null>(null);
  const clientRef = useRef<ReturnType<typeof getAblyRealtimeClient> | null>(null);

  useEffect(() => {
    if (session?.user?.id && !clientRef.current) {
      const client = getAblyRealtimeClient();
      client.connect();
      clientRef.current = client;
      setAblyClient(client);
    }
  }, [session?.user?.id]);

  const isReady = !!(session?.user?.id && ablyClient);

  return (
    <AblyReadyContext.Provider value={isReady}>
      <CommentCountProvider>
        {isReady && <AblyFeatures client={ablyClient} />}
        {!isReady && <Toaster position="bottom-right" />}
        <CookieToast />
        {children}
      </CommentCountProvider>
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
