"use client";

import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Reads a `_switchTo` query param (set by /api/finish-link) and
 * tells NextAuth to switch the JWT to the original user's identity.
 * Renders nothing — just performs the side-effect once.
 */
export function AutoAccountSwitch() {
  const { update } = useSession();
  const searchParams = useSearchParams();
  const switchTo = searchParams.get("_switchTo");
  const didRun = useRef(false);

  useEffect(() => {
    if (!switchTo || didRun.current) return;
    didRun.current = true;

    update({ switchToUserId: switchTo }).then(() => {
      // Full reload so every server component, layout, and client cache
      // picks up the new identity. Remove the _switchTo param first.
      const url = new URL(window.location.href);
      url.searchParams.delete("_switchTo");
      window.location.replace(url.pathname + url.search);
    });
  }, [switchTo, update]);

  return null;
}
