import { useCallback, useEffect, useRef, useState } from "react";
import * as Ably from "ably";
import { ablyClient } from "@/lib/ably";

const TYPING_TIMEOUT = 3000;

export function useTypingIndicator(
  conversationId: string,
  currentUserId: string
) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof ablyClient.channels.get> | null>(
    null
  );

  useEffect(() => {
    const channelName = `typing:${conversationId}`;
    const channel = ablyClient.channels.get(channelName);
    channelRef.current = channel;

    const listener = (event: Ably.InboundMessage) => {
      const userId = (event.data as { userId?: string })?.userId;
      if (!userId || userId === currentUserId) return;

      if (event.name === "start") {
        setTypingUsers((prev) => new Set(prev).add(userId));

        const existing = typingTimers.current.get(userId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
          typingTimers.current.delete(userId);
        }, TYPING_TIMEOUT);
        typingTimers.current.set(userId, timer);
      } else if (event.name === "stop") {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
        const existing = typingTimers.current.get(userId);
        if (existing) {
          clearTimeout(existing);
          typingTimers.current.delete(userId);
        }
      }
    };

    channel.subscribe(listener);

    return () => {
      channel.unsubscribe(listener);
      typingTimers.current.forEach((timer) => clearTimeout(timer));
      typingTimers.current.clear();
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    };
  }, [conversationId, currentUserId]);

  const startTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    channel.publish("start", { userId: currentUserId });

    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    sendTimerRef.current = setTimeout(() => {
      channel.publish("stop", { userId: currentUserId });
    }, TYPING_TIMEOUT);
  }, [currentUserId]);

  const stopTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    channel.publish("stop", { userId: currentUserId });
    if (sendTimerRef.current) {
      clearTimeout(sendTimerRef.current);
      sendTimerRef.current = null;
    }
  }, [currentUserId]);

  return {
    isTyping: typingUsers.size > 0,
    typingUsers,
    startTyping,
    stopTyping,
  };
}
