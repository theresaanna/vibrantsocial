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

// Separate component that only mounts when Ably is ready.
// This avoids the "Rendered more hooks" error from conditional hook calls.
function AblyFeatures({ client, children }: { client: ReturnType<typeof getAblyRealtimeClient>; children: React.ReactNode }) {
  return (
    <AblyProvider client={client}>
      <AblyReadyContext.Provider value={true}>
        <CommentCountProvider>
          <ChannelProvider channelName={PRESENCE_CHANNEL}>
            <PresenceEntry />
            <ToastProvider />
            <CookieToast />
            {children}
          </ChannelProvider>
        </CommentCountProvider>
      </AblyReadyContext.Provider>
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

  const fallback = (
    <AblyReadyContext.Provider value={false}>
      <CommentCountProvider>
        <Toaster position="bottom-right" />
        <CookieToast />
        {children}
      </CommentCountProvider>
    </AblyReadyContext.Provider>
  );

  if (!session?.user?.id || !ablyClient) {
    return fallback;
  }

  return (
    <AblyFeatures client={ablyClient}>
      {children}
    </AblyFeatures>
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
