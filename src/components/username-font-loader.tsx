"use client";

import { useEffect, useState } from "react";
import { getFontById, getGoogleFontUrl } from "@/lib/profile-fonts";

interface UsernameFontLoaderProps {
  fontId: string | null;
}

/**
 * Lazy-loads a Google Font stylesheet for a user's custom username font.
 * Renders nothing visible — just injects the <link> tag.
 */
export function UsernameFontLoader({ fontId }: UsernameFontLoaderProps) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!fontId) return;

    const font = getFontById(fontId);
    if (!font) return;

    const linkId = `username-font-${fontId}`;
    if (document.getElementById(linkId)) {
      setLoaded(true);
      return;
    }

    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = getGoogleFontUrl(font);
    link.onload = () => setLoaded(true);
    document.head.appendChild(link);
  }, [fontId]);

  return null;
}

/**
 * Returns the CSS fontFamily string for a given font ID, or undefined for default.
 */
export function getUsernameFontFamily(fontId: string | null): string | undefined {
  if (!fontId) return undefined;
  const font = getFontById(fontId);
  if (!font) return undefined;
  return `'${font.name}', sans-serif`;
}
