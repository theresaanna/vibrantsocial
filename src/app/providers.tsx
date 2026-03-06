"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { AblyProvider } from "ably/react";
import { getAblyRealtimeClient } from "@/lib/ably";
import { useEffect, useRef } from "react";

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
    return <>{children}</>;
  }

  return (
    <AblyProvider client={clientRef.current}>
      {children}
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
