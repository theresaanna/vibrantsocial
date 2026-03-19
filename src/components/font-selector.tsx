"use client";

import { useState, useEffect } from "react";
import { USERNAME_FONTS, getFontById, getGoogleFontsUrl, type FontDefinition } from "@/lib/profile-fonts";
import { PremiumCrown } from "./premium-crown";

interface FontSelectorProps {
  currentFontId: string | null;
  displayName: string;
  isPremium: boolean;
  userEmail?: string | null;
  onSelect: (fontId: string | null) => void;
}

function useLazyFonts(fonts: FontDefinition[]) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (fonts.length === 0) return;

    const url = getGoogleFontsUrl(fonts);
    const linkId = "font-selector-styles";

    // Check if already loaded
    if (document.getElementById(linkId)) {
      setLoaded(true);
      return;
    }

    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = url;
    link.onload = () => setLoaded(true);
    document.head.appendChild(link);

    return () => {
      // Don't remove - fonts may be in use
    };
  }, [fonts]);

  return loaded;
}

export function FontSelector({
  currentFontId,
  displayName,
  isPremium,
  onSelect,
}: FontSelectorProps) {
  const [selectedFontId, setSelectedFontId] = useState<string | null>(currentFontId);
  const [expanded, setExpanded] = useState(false);

  const freeFonts = USERNAME_FONTS.filter((f) => f.tier === "free");
  const premiumFonts = USERNAME_FONTS.filter((f) => f.tier === "premium");

  // Lazy-load all fonts for the selector preview
  const fontsToLoad = isPremium ? USERNAME_FONTS : freeFonts;
  useLazyFonts(fontsToLoad);

  const selectedFont = getFontById(selectedFontId);
  const previewFontFamily = selectedFont ? `'${selectedFont.name}', sans-serif` : undefined;

  function handleSelect(fontId: string | null) {
    setSelectedFontId(fontId);
    onSelect(fontId);
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700" data-testid="font-selector">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
        data-testid="font-selector-toggle"
      >
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Username Font
          {selectedFont && (
            <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
              ({selectedFont.name})
            </span>
          )}
        </span>
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!expanded ? null : <>
      {/* Live preview */}
      <div className="mt-3 mb-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800" data-testid="font-preview">
        <p className="text-center text-xl font-bold text-zinc-900 dark:text-zinc-100" style={{ fontFamily: previewFontFamily }}>
          {displayName || "Your Name"}
        </p>
      </div>

      {/* Default (Lexend) option */}
      <button
        type="button"
        onClick={() => handleSelect(null)}
        className={`mb-3 w-full rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
          selectedFontId === null
            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
            : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        aria-pressed={selectedFontId === null}
        data-testid="font-option-default"
      >
        Lexend (Default)
      </button>

      {/* Free fonts */}
      <div className="mb-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Free
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {freeFonts.map((font) => (
            <button
              key={font.id}
              type="button"
              onClick={() => handleSelect(font.id)}
              className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                selectedFontId === font.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
              aria-pressed={selectedFontId === font.id}
              data-testid={`font-option-${font.id}`}
            >
              <span
                className="block text-base text-zinc-900 dark:text-zinc-100"
                style={{ fontFamily: `'${font.name}', sans-serif` }}
              >
                {font.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Premium fonts */}
      <div className={`relative ${!isPremium ? "pointer-events-none opacity-50" : ""}`} data-testid={!isPremium ? "font-upgrade-prompt" : undefined}>
        {!isPremium && <PremiumCrown />}
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Premium
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {premiumFonts.map((font) => (
            <button
              key={font.id}
              type="button"
              onClick={() => handleSelect(font.id)}
              disabled={!isPremium}
              className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                selectedFontId === font.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              } disabled:cursor-not-allowed`}
              aria-pressed={selectedFontId === font.id}
              data-testid={`font-option-${font.id}`}
            >
              <span
                className="block text-base text-zinc-900 dark:text-zinc-100"
                style={isPremium ? { fontFamily: `'${font.name}', sans-serif` } : undefined}
              >
                {font.name}
              </span>
            </button>
          ))}
        </div>
      </div>
      </>}
    </div>
  );
}
