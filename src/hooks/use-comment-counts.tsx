"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useAblyReady } from "@/app/providers";
import { getAblyRealtimeClient } from "@/lib/ably";

type CountCallback = (count: number) => void;

interface CommentCountManager {
  subscribe: (postId: string, cb: CountCallback) => () => void;
}

const CommentCountContext = createContext<CommentCountManager | null>(null);

/**
 * Centralized Ably comment-count subscription manager.
 *
 * Instead of each PostCard opening its own channel subscription, this provider
 * manages subscriptions for all visible posts in one place. When a PostCard
 * mounts it registers via `useCommentCount`; when it unmounts (e.g. during
 * virtualized scroll) it unregisters with a 5-second debounce so the channel
 * stays warm if the user scrolls back.
 */
export function CommentCountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const ablyReady = useAblyReady();
  const ablyReadyRef = useRef(ablyReady);
  ablyReadyRef.current = ablyReady;

  // postId → set of callbacks that want count updates
  const listenersRef = useRef(new Map<string, Set<CountCallback>>());

  // postId → Ably channel unsubscribe function
  const channelsRef = useRef(
    new Map<string, { unsubscribe: () => void }>()
  );

  // postId → debounce timer for delayed unsubscription
  const unsubTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>()
  );

  const ensureChannelSubscription = useCallback((postId: string) => {
    if (!ablyReadyRef.current) return;
    if (channelsRef.current.has(postId)) return;

    const client = getAblyRealtimeClient();
    const channel = client.channels.get(`comments:${postId}`);

    const handler = (message: { data?: { count: number } }) => {
      if (typeof message.data?.count === "number") {
        const callbacks = listenersRef.current.get(postId);
        if (callbacks) {
          for (const cb of callbacks) {
            cb(message.data.count);
          }
        }
      }
    };

    channel.subscribe("count", handler);
    channelsRef.current.set(postId, {
      unsubscribe: () => channel.unsubscribe("count", handler),
    });
  }, []);

  // When Ably becomes ready, subscribe to channels for any already-registered post IDs
  useEffect(() => {
    if (!ablyReady) return;
    for (const postId of listenersRef.current.keys()) {
      ensureChannelSubscription(postId);
    }
  }, [ablyReady, ensureChannelSubscription]);

  const subscribe = useCallback(
    (postId: string, cb: CountCallback): (() => void) => {
      // Add listener
      if (!listenersRef.current.has(postId)) {
        listenersRef.current.set(postId, new Set());
      }
      listenersRef.current.get(postId)!.add(cb);

      // Clear any pending unsubscribe timer
      const timer = unsubTimersRef.current.get(postId);
      if (timer) {
        clearTimeout(timer);
        unsubTimersRef.current.delete(postId);
      }

      // Subscribe to Ably channel if ready and not already subscribed
      ensureChannelSubscription(postId);

      // Cleanup: remove listener, debounce channel unsubscribe
      return () => {
        const listeners = listenersRef.current.get(postId);
        if (listeners) {
          listeners.delete(cb);

          if (listeners.size === 0) {
            listenersRef.current.delete(postId);

            // Debounce unsubscribe by 5s to avoid thrashing during scroll
            const unsubTimer = setTimeout(() => {
              const sub = channelsRef.current.get(postId);
              if (sub && !listenersRef.current.has(postId)) {
                sub.unsubscribe();
                channelsRef.current.delete(postId);
              }
              unsubTimersRef.current.delete(postId);
            }, 5000);
            unsubTimersRef.current.set(postId, unsubTimer);
          }
        }
      };
    },
    [ensureChannelSubscription]
  );

  // Stable manager reference — avoids context value changing on every render
  const managerRef = useRef<CommentCountManager>({ subscribe });
  managerRef.current.subscribe = subscribe;

  return (
    <CommentCountContext.Provider value={managerRef.current}>
      {children}
    </CommentCountContext.Provider>
  );
}

/**
 * Subscribe to real-time comment count updates for a post.
 *
 * Returns `[count, setCount]` so the consumer can also update the count
 * locally (e.g. when the user adds a comment via optimistic update).
 */
export function useCommentCount(
  postId: string,
  initialCount: number
): [number, (count: number | ((prev: number) => number)) => void] {
  const manager = useContext(CommentCountContext);
  const [count, setCount] = useState(initialCount);

  // Sync from server when initial count prop changes (after revalidation)
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  // Register with the centralized provider
  useEffect(() => {
    if (!manager) return;
    return manager.subscribe(postId, setCount);
  }, [manager, postId]);

  return [count, setCount];
}
