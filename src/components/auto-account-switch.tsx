"use client";

import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Reads a `_switchTo` query param (set by /api/auth/finish-link) and
 * tells NextAuth to switch the JWT to the original user's identity.
 * Renders nothing — just performs the side-effect once.
 */
export function AutoAccountSwitch() {
  const { update } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const switchTo = searchParams.get("_switchTo");
  const didRun = useRef(false);

  useEffect(() => {
    if (!switchTo || didRun.current) return;
    didRun.current = true;

    update({ switchToUserId: switchTo }).then(() => {
      // Remove the query param from the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("_switchTo");
      router.replace(url.pathname + url.search);
    });
  }, [switchTo, update, router]);

  return null;
}
