"use client";

import { useState, useEffect, useCallback } from "react";

const POLL_INTERVAL = 300_000; // 5 minutes
const initialBuildId = process.env.NEXT_PUBLIC_BUILD_ID;

export function useAppVersion() {
  const [hasUpdate, setHasUpdate] = useState(false);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch("/api/version");
      if (!res.ok) return;
      const { buildId } = await res.json();
      if (buildId && buildId !== initialBuildId) {
        setHasUpdate(true);
      }
    } catch {
      // Network error — skip this check
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(checkVersion, POLL_INTERVAL);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkVersion();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkVersion]);

  return { hasUpdate };
}
