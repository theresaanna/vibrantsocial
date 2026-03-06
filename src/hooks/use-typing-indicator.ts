"use client";

import { useChannel } from "ably/react";
import { useCallback, useEffect, useRef, useState } from "react";

const TYPING_TIMEOUT = 3000;

export function useTypingIndicator(
  conversationId: string,
  currentUserId: string
) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const sendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelName = `typing:${conversationId}`;

  const { channel } = useChannel(channelName, (event) => {
    const userId = event.data?.userId as string;
    if (!userId || userId === currentUserId) return;

    if (event.name === "start") {
      setTypingUsers((prev) => new Set(prev).add(userId));

      // Clear existing timer for this user
      const existing = typingTimers.current.get(userId);
      if (existing) clearTimeout(existing);

      // Auto-remove after timeout
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
  });

  const keystroke = useCallback(() => {
    if (!channel) return;
    channel.publish("start", { userId: currentUserId });

    // Auto-stop after timeout
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    sendTimerRef.current = setTimeout(() => {
      channel.publish("stop", { userId: currentUserId });
    }, TYPING_TIMEOUT);
  }, [channel, currentUserId]);

  const stopTyping = useCallback(() => {
    if (!channel) return;
    channel.publish("stop", { userId: currentUserId });
    if (sendTimerRef.current) {
      clearTimeout(sendTimerRef.current);
      sendTimerRef.current = null;
    }
  }, [channel, currentUserId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      typingTimers.current.forEach((timer) => clearTimeout(timer));
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    };
  }, []);

  return { typingUsers, keystroke, stopTyping };
}
