"use client";

import { useState, useCallback, useId } from "react";
import {
  type ProfileThemeColors,
  PROFILE_THEME_PRESETS,
  THEME_COLOR_FIELDS,
  isValidHexColor,
} from "@/lib/profile-themes";
import { ThemePreview } from "./theme-preview";
import { PremiumCrown } from "./premium-crown";

interface ThemeEditorProps {
  initialColors: Partial<ProfileThemeColors>;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarSrc: string | null;
  onChange?: () => void;
  isPremium?: boolean;
  userEmail?: string | null;
}

const COLOR_LABELS: Record<keyof ProfileThemeColors, string> = {
  profileBgColor: "Background",
  profileTextColor: "Text",
  profileLinkColor: "Links",
  profileSecondaryColor: "Secondary Text",
  profileContainerColor: "Container",
};

export function ThemeEditor({
  initialColors,
  username,
  displayName,
  bio,
  avatarSrc,
  onChange,
  isPremium = true,
  userEmail,
}: ThemeEditorProps) {
  const defaultPreset = PROFILE_THEME_PRESETS.default;
  const [colors, setColors] = useState<ProfileThemeColors>({
    profileBgColor: initialColors.profileBgColor ?? defaultPreset.profileBgColor,
    profileTextColor: initialColors.profileTextColor ?? defaultPreset.profileTextColor,
    profileLinkColor: initialColors.profileLinkColor ?? defaultPreset.profileLinkColor,
    profileSecondaryColor: initialColors.profileSecondaryColor ?? defaultPreset.profileSecondaryColor,
    profileContainerColor: initialColors.profileContainerColor ?? defaultPreset.profileContainerColor,
  });
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  const handlePresetSelect = useCallback((presetName: string) => {
    setColors(PROFILE_THEME_PRESETS[presetName]);
    setActivePreset(presetName);
    onChange?.();
  }, [onChange]);

  const handleColorChange = useCallback(
    (field: keyof ProfileThemeColors, value: string) => {
      setColors((prev) => ({ ...prev, [field]: value }));
      setActivePreset(null);
      onChange?.();
    },
    [onChange]
  );

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Profile Theme
        </h2>
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
      <div id={contentId} className="space-y-4 px-4 pb-4">

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(PROFILE_THEME_PRESETS).map(([name, preset]) => (
          <button
            key={name}
            type="button"
            onClick={() => handlePresetSelect(name)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium capitalize transition-all ${
              activePreset === name
                ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900"
                : "border-transparent"
            }`}
            style={{
              backgroundColor: preset.profileContainerColor,
              color: preset.profileTextColor,
            }}
            aria-pressed={activePreset === name}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Individual color pickers — premium only */}
      <div className="relative" data-testid={isPremium ? "custom-color-pickers" : "custom-colors-upgrade-prompt"}>
        <PremiumCrown href="/premium" />
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${!isPremium ? "pointer-events-none opacity-50" : ""}`}>
          {THEME_COLOR_FIELDS.map((field) => (
            <div key={field} className="flex items-center gap-2">
              <input
                type="color"
                value={colors[field]}
                onChange={(e) => handleColorChange(field, e.target.value)}
                disabled={!isPremium}
                className="h-8 w-8 cursor-pointer rounded border border-zinc-300 dark:border-zinc-600"
                aria-label={COLOR_LABELS[field]}
              />
              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {COLOR_LABELS[field]}
                </label>
                <input
                  type="text"
                  value={colors[field]}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.length <= 7) {
                      handleColorChange(field, v);
                    }
                  }}
                  onBlur={(e) => {
                    if (!isValidHexColor(e.target.value)) {
                      handleColorChange(field, defaultPreset[field]);
                    }
                  }}
                  disabled={!isPremium}
                  className="w-20 rounded border border-zinc-300 bg-transparent px-1.5 py-0.5 text-xs dark:border-zinc-600 dark:text-zinc-100"
                  maxLength={7}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview button */}
      <button
        type="button"
        onClick={() => setShowPreview(true)}
        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        Preview Light &amp; Dark
      </button>

      {/* Preview modal */}
      {showPreview && (
        <ThemePreview
          colors={colors}
          username={username}
          displayName={displayName}
          bio={bio}
          avatarSrc={avatarSrc}
          onClose={() => setShowPreview(false)}
        />
      )}
      </div>
      )}

      {/* Hidden form inputs — always rendered for form submission */}
      {THEME_COLOR_FIELDS.map((field) => (
        <input key={field} type="hidden" name={field} value={colors[field]} />
      ))}
    </div>
  );
}
