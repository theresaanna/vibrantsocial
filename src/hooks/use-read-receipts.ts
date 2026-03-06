"use client";

import { useChannel } from "ably/react";
import { useCallback, useState } from "react";

interface ReadReceiptData {
  userId: string;
  timestamp: string;
}

export function useReadReceipts(conversationId: string) {
  const [readTimestamps, setReadTimestamps] = useState<
    Map<string, Date>
  >(new Map());

  const channelName = `read:${conversationId}`;

  const { channel } = useChannel(channelName, (event) => {
    if (event.name === "read") {
      const data = event.data as ReadReceiptData;
      setReadTimestamps((prev) => {
        const next = new Map(prev);
        next.set(data.userId, new Date(data.timestamp));
        return next;
      });
    }
  });

  const publishRead = useCallback(
    (userId: string) => {
      if (!channel) return;
      channel.publish("read", {
        userId,
        timestamp: new Date().toISOString(),
      });
    },
    [channel]
  );

  return { readTimestamps, publishRead };
}
