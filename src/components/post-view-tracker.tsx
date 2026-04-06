"use client";

import { useEffect, useRef, useCallback } from "react";
import { rpc } from "@/lib/rpc";
import type { ViewSource } from "@/app/feed/view-actions";

interface PostViewTrackerProps {
  postId: string;
  source: ViewSource;
  children: React.ReactNode;
}

/**
 * Wraps a post card and records a view when 50% of it enters the viewport.
 * Fires at most once per mount.
 */
export function PostViewTracker({ postId, source, children }: PostViewTrackerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const trackedRef = useRef(false);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (trackedRef.current) return;
      if (entries[0]?.isIntersecting) {
        trackedRef.current = true;
        rpc("recordPostView", {
          postId,
          source,
          referrer: document.referrer || null,
        }).catch(() => {});
      }
    },
    [postId, source],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.5,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersection]);

  return <div ref={ref}>{children}</div>;
}
