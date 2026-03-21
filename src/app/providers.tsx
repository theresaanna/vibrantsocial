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

function AblyProviderWrapper({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const clientRef = useRef<ReturnType<typeof getAblyRealtimeClient> | null>(null);
  const [ablyConnected, setAblyConnected] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;

    if (!clientRef.current) {
      clientRef.current = getAblyRealtimeClient();
    }

    const client = clientRef.current;

    const onStateChange = (stateChange: { current: string }) => {
      setAblyConnected(stateChange.current === "connected");
    };

    client.connection.on(onStateChange);

    // If already connected (e.g. singleton reused), sync state immediately
    if (client.connection.state === "connected") {
      setAblyConnected(true);
    } else {
      client.connect();
    }

    return () => {
      client.connection.off(onStateChange);
    };
  }, [session?.user?.id]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.close();
        clientRef.current = null;
        setAblyConnected(false);
      }
    };
  }, []);

  if (!session?.user?.id || !clientRef.current || !ablyConnected) {
    return (
      <AblyReadyContext.Provider value={false}>
        <CommentCountProvider>
          <Toaster position="bottom-right" />
          <CookieToast />
          {children}
        </CommentCountProvider>
      </AblyReadyContext.Provider>
    );
  }

  return (
    <AblyProvider client={clientRef.current}>
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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AblyProviderWrapper>{children}</AblyProviderWrapper>
      </ThemeProvider>
    </SessionProvider>
  );
}
