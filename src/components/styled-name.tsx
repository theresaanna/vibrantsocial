"use client";

import { useEffect, type ReactNode } from "react";
import { getFontById, getGoogleFontUrl } from "@/lib/profile-fonts";

interface StyledNameProps {
  fontId: string | null | undefined;
  children: ReactNode;
  ageVerified?: boolean;
}

/**
 * Wraps children (a display name) in a span with a custom Google Font applied.
 * Lazy-loads the font stylesheet on first render, deduped by fontId.
 * If fontId is null/undefined, renders children without a wrapper.
 */
const AgeVerifiedIcon = () => (
  <svg
    className="inline-block h-3.5 w-3.5 shrink-0 text-blue-500"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-label="Age verified"
  >
    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
  </svg>
);

export function StyledName({ fontId, children, ageVerified }: StyledNameProps) {
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

  if (!fontId) {
    if (ageVerified) {
      return <span className="inline-flex items-center gap-0.5">{children}<AgeVerifiedIcon /></span>;
    }
    return <>{children}</>;
  }

  const font = getFontById(fontId);
  if (!font) {
    if (ageVerified) {
      return <span className="inline-flex items-center gap-0.5">{children}<AgeVerifiedIcon /></span>;
    }
    return <>{children}</>;
  }

  return (
    <span className={ageVerified ? "inline-flex items-center gap-0.5" : undefined} style={{ fontFamily: `'${font.name}', sans-serif` }}>
      {children}
      {ageVerified && <AgeVerifiedIcon />}
    </span>
  );
}
