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
    if (document.getElementById(linkId)) return;

    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = getGoogleFontUrl(font);
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
