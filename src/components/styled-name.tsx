"use client";

import { useEffect, type ReactNode } from "react";
import { getFontById, getGoogleFontUrl } from "@/lib/profile-fonts";

interface StyledNameProps {
  fontId: string | null | undefined;
  children: ReactNode;
}

/**
 * Wraps children (a display name) in a span with a custom Google Font applied.
 * Lazy-loads the font stylesheet on first render, deduped by fontId.
 * If fontId is null/undefined, renders children without a wrapper.
 */
export function StyledName({ fontId, children }: StyledNameProps) {
  useEffect(() => {
    if (!fontId) return;

    const font = getFontById(fontId);
    if (!font) return;

    const linkId = `username-font-${fontId}`;
    const existing = document.getElementById(linkId) as HTMLLinkElement | null;

    // If the link already exists and loaded successfully, nothing to do.
    // If it exists but failed, remove it so we can retry.
    if (existing) {
      if (existing.dataset.failed) {
        existing.remove();
      } else {
        return;
      }
    }

    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.crossOrigin = "anonymous";
    link.href = getGoogleFontUrl(font);
    link.onerror = () => {
      link.dataset.failed = "1";
    };
    document.head.appendChild(link);
  }, [fontId]);

  if (!fontId) return <>{children}</>;

  const font = getFontById(fontId);
  if (!font) return <>{children}</>;

  return (
    <span style={{ fontFamily: `'${font.name}', sans-serif` }}>
      {children}
    </span>
  );
}
