import { useCallback, useEffect, useRef, useState } from "react";
import * as Ably from "ably";
import { ablyClient } from "@/lib/ably";

interface ReadReceiptData {
  userId: string;
  timestamp: string;
}

export function useReadReceipts(conversationId: string) {
  const [readTimestamps, setReadTimestamps] = useState<Map<string, Date>>(
    new Map()
  );
  const channelRef = useRef<ReturnType<typeof ablyClient.channels.get> | null>(
    null
  );

  useEffect(() => {
    const channelName = `read:${conversationId}`;
    const channel = ablyClient.channels.get(channelName);
    channelRef.current = channel;

    const listener = (event: Ably.InboundMessage) => {
      if (event.name === "read" && event.data) {
        const data = event.data as ReadReceiptData;
        setReadTimestamps((prev) => {
          const next = new Map(prev);
          next.set(data.userId, new Date(data.timestamp));
          return next;
        });
      }
    };

    channel.subscribe(listener);

    return () => {
      channel.unsubscribe(listener);
    };
  }, [conversationId]);

  const publishRead = useCallback(
    (userId: string) => {
      const channel = channelRef.current;
      if (!channel) return;
      channel.publish("read", {
        userId,
        timestamp: new Date().toISOString(),
      });
    },
    []
  );

  /**
   * Determine read status for a message based on whether any other user
   * has a read timestamp >= the message creation time.
   */
  const getReadStatus = useCallback(
    (
      messageCreatedAt: Date,
      senderId: string
    ): "sent" | "delivered" | "read" => {
      for (const [userId, timestamp] of readTimestamps) {
        if (userId === senderId) continue;
        if (timestamp >= messageCreatedAt) return "read";
      }
      return "delivered";
    },
    [readTimestamps]
  );

  return { readTimestamps, publishRead, getReadStatus };
}
