"use client";

import { useEffect, useRef } from "react";
import { rpc } from "@/lib/rpc";
import type { ViewSource } from "@/app/feed/view-actions";

/**
 * Track a single post view (e.g. on a post detail page).
 * Fires once per postId per component mount.
 */
export function usePostViewTracking(
  postId: string,
  source: ViewSource,
  enabled = true,
) {
  const trackedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || trackedRef.current.has(postId)) return;
    trackedRef.current.add(postId);

    rpc("recordPostView", {
      postId,
      source,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    }).catch(() => {});
  }, [postId, source, enabled]);
}
