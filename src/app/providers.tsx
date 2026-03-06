"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { AblyProvider } from "ably/react";
import { getAblyRealtimeClient } from "@/lib/ably";
import { createContext, useContext, useEffect, useRef } from "react";

const AblyReadyContext = createContext(false);

export function useAblyReady() {
  return useContext(AblyReadyContext);
}

function AblyProviderWrapper({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const clientRef = useRef<ReturnType<typeof getAblyRealtimeClient> | null>(null);

  useEffect(() => {
    if (session?.user?.id && !clientRef.current) {
      clientRef.current = getAblyRealtimeClient();
      clientRef.current.connect();
    }
    return () => {
      if (clientRef.current) {
        clientRef.current.close();
        clientRef.current = null;
      }
    };
  }, [session?.user?.id]);

  if (!session?.user?.id || !clientRef.current) {
    return (
      <AblyReadyContext.Provider value={false}>
        {children}
      </AblyReadyContext.Provider>
    );
  }

  return (
    <AblyProvider client={clientRef.current}>
      <AblyReadyContext.Provider value={true}>
        {children}
      </AblyReadyContext.Provider>
    </AblyProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AblyProviderWrapper>{children}</AblyProviderWrapper>
    </SessionProvider>
  );
}
