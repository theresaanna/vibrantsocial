"use client";

import { AblyProvider, ChannelProvider, usePresence } from "ably/react";
import { getAblyRealtimeClient } from "@/lib/ably";
import { AblyReadyContext } from "@/lib/ably-ready-context";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { ToastProvider } from "@/components/toast-provider";
import { Toaster } from "sonner";
import { CookieToast } from "@/components/cookie-toast";
import { CommentCountProvider } from "@/hooks/use-comment-counts";

const PRESENCE_CHANNEL = "presence:global";

function PresenceEntry() {
  usePresence(PRESENCE_CHANNEL, { status: "online" });
  return null;
}

// Presence + toast features that mount only when Ably is connected.
function AblyFeatures() {
  return (
    <>
      <PresenceEntry />
      <ToastProvider />
    </>
  );
}

/**
 * Ably provider wrapper — dynamically imported so the Ably SDK
 * is not in the initial JS bundle for logged-out visitors.
 */
export default function AblyProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const [ablyClient] = useState(() => getAblyRealtimeClient());
  const connectedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (session?.user?.id && !connectedRef.current) {
      connectedRef.current = true;
      ablyClient.connect();
      setIsReady(true);
    }
  }, [session?.user?.id, ablyClient]);

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
