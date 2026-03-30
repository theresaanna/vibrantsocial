"use client";

import { useState, useCallback, useId, useTransition, useRef, useEffect } from "react";
import {
  type ProfileThemeColors,
  type CustomPresetData,
  PROFILE_THEME_PRESETS,
  THEME_COLOR_FIELDS,
} from "@/lib/profile-themes";
import {
  saveCustomPreset,
  deleteCustomPreset,
} from "@/app/theme/generate-theme-action";
import { PremiumCrown } from "./premium-crown";

interface ThemeEditorProps {
  initialColors: Partial<ProfileThemeColors>;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarSrc: string | null;
  onChange?: () => void;
  onColorsChange?: (colors: ProfileThemeColors) => void;
  isPremium?: boolean;
  userEmail?: string | null;
  customPresets?: CustomPresetData[];
}

export function ThemeEditor({
  initialColors,
  username,
  displayName,
  bio,
  avatarSrc,
  onChange,
  onColorsChange,
  isPremium = true,
  userEmail,
  customPresets: initialCustomPresets = [],
}: ThemeEditorProps) {
  const defaultPreset = PROFILE_THEME_PRESETS.default;
  const savedColors = useRef<ProfileThemeColors>({
    profileBgColor:
      initialColors.profileBgColor ?? defaultPreset.profileBgColor,
    profileTextColor:
      initialColors.profileTextColor ?? defaultPreset.profileTextColor,
    profileLinkColor:
      initialColors.profileLinkColor ?? defaultPreset.profileLinkColor,
    profileSecondaryColor:
      initialColors.profileSecondaryColor ??
      defaultPreset.profileSecondaryColor,
    profileContainerColor:
      initialColors.profileContainerColor ??
      defaultPreset.profileContainerColor,
  });
  const [colors, setColors] = useState<ProfileThemeColors>({ ...savedColors.current });
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const hasUnsavedThemeChange = THEME_COLOR_FIELDS.some(
    (f) => colors[f] !== savedColors.current[f]
  );
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  const [isSaving, startSaveTransition] = useTransition();
  const [customPresets, setCustomPresets] =
    useState<CustomPresetData[]>(initialCustomPresets);
  const [saveCurrentName, setSaveCurrentName] = useState("");
  const [showSaveCurrent, setShowSaveCurrent] = useState(false);
  const [saveCurrentError, setSaveCurrentError] = useState<string | null>(null);

  // Notify parent of live color changes for real-time preview
  useEffect(() => {
    onColorsChange?.(colors);
  }, [colors, onColorsChange]);

  // --- Theme handlers ---

  const handlePresetSelect = useCallback(
    (presetName: string) => {
      setColors(PROFILE_THEME_PRESETS[presetName]);
      setActivePreset(presetName);
      onChange?.();
    },
    [onChange]
  );

  const handleCustomPresetSelect = useCallback(
    (preset: CustomPresetData) => {
      setColors(preset.light);
      setActivePreset(`custom:${preset.id}`);
      onChange?.();
    },
    [onChange]
  );

  const handleSaveCurrentTheme = useCallback(() => {
    if (!saveCurrentName.trim() || isSaving) return;
    startSaveTransition(async () => {
      const result = await saveCustomPreset(
        saveCurrentName.trim(),
        colors,
        ""
      );
      if (result.success && result.preset) {
        setCustomPresets((prev) => [...prev, result.preset!]);
        setSaveCurrentName("");
        setShowSaveCurrent(false);
        setSaveCurrentError(null);
      } else {
        setSaveCurrentError(result.error ?? "Failed to save preset");
      }
    });
  }, [colors, saveCurrentName, isSaving]);

  const handleDeletePreset = useCallback(
    (presetId: string) => {
      startSaveTransition(async () => {
        const result = await deleteCustomPreset(presetId);
        if (result.success) {
          setCustomPresets((prev) => prev.filter((p) => p.id !== presetId));
          if (activePreset === `custom:${presetId}`) {
            setActivePreset(null);
          }
        }
      });
    },
    [activePreset]
  );

  const name = displayName || username || "Your Name";
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Theme
        </h2>
        <svg
          className={`h-5 w-5 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div id={contentId} className="space-y-4 px-4 pb-4">
          {/* Inline real-time preview */}
          <div
            className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700"
          >
            <div
              className="p-4"
              style={{ backgroundColor: colors.profileBgColor }}
            >
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: colors.profileContainerColor }}
              >
                <div className="flex items-start gap-3">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt=""
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                      style={{
                        backgroundColor: colors.profileSecondaryColor + "33",
                        color: colors.profileTextColor,
                      }}
                    >
                      {initial}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-sm font-bold"
                      style={{ color: colors.profileTextColor }}
                    >
                      {name}
                    </h3>
                    <p
                      className="text-xs"
                      style={{ color: colors.profileSecondaryColor }}
                    >
                      @{username || "username"}
                    </p>
                  </div>
                </div>

                <p
                  className="mt-2 text-xs"
                  style={{ color: colors.profileSecondaryColor }}
                >
                  {bio || "This is what your bio will look like with these colors."}
                </p>

                <div className="mt-2 flex gap-3 text-xs">
                  <span style={{ color: colors.profileSecondaryColor }}>
                    <span
                      className="font-semibold"
                      style={{ color: colors.profileTextColor }}
                    >
                      42
                    </span>{" "}
                    posts
                  </span>
                  <span style={{ color: colors.profileSecondaryColor }}>
                    <span
                      className="font-semibold"
                      style={{ color: colors.profileTextColor }}
                    >
                      128
                    </span>{" "}
                    followers
                  </span>
                </div>
              </div>

              {/* Sample post */}
              <div
                className="mt-2 rounded-xl p-3"
                style={{ backgroundColor: colors.profileContainerColor }}
              >
                <p
                  className="text-xs"
                  style={{ color: colors.profileTextColor }}
                >
                  Just posted something cool! Check out{" "}
                  <span style={{ color: colors.profileLinkColor }}>
                    this link
                  </span>{" "}
                  for more details.
                </p>
                <p
                  className="mt-1 text-[10px]"
                  style={{ color: colors.profileSecondaryColor }}
                >
                  2 hours ago
                </p>
              </div>
            </div>
          </div>

          {/* Unsaved theme indicator */}
          {hasUnsavedThemeChange && (
            <div
              className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-950"
              data-testid="unsaved-theme-indicator"
            >
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Theme changed
                </span>
              </div>
              <div className="flex gap-1.5">
                {THEME_COLOR_FIELDS.map((field) => (
                  <span
                    key={field}
                    className="inline-block h-4 w-4 rounded-full border border-zinc-300 dark:border-zinc-600"
                    style={{ backgroundColor: colors[field] }}
                    title={field.replace("profile", "").replace("Color", "")}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Save current theme as preset — premium only */}
          {isPremium && (
            <div>
              {!showSaveCurrent ? (
                <button
                  type="button"
                  onClick={() => setShowSaveCurrent(true)}
                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Save Current Theme as Preset
                </button>
              ) : (
                <div className="space-y-2">
                  <div
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                    data-testid="save-current-theme-form"
                  >
                    <input
                      type="text"
                      value={saveCurrentName}
                      onChange={(e) => setSaveCurrentName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveCurrentTheme();
                        }
                      }}
                      placeholder="Preset name"
                      className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-600 dark:text-zinc-100"
                      maxLength={30}
                      data-testid="save-current-name-input"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCurrentTheme}
                      disabled={isSaving || !saveCurrentName.trim()}
                      className="rounded-lg bg-green-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                      data-testid="save-current-button"
                    >
                      {isSaving ? "Saving..." : "Save Preset"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSaveCurrent(false);
                        setSaveCurrentName("");
                        setSaveCurrentError(null);
                      }}
                      className="rounded-lg px-2 py-1 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </div>
                  {saveCurrentError && (
                    <p className="text-xs text-red-500">{saveCurrentError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Theme preset buttons */}
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Color Theme
            </label>
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

              {/* Custom preset pills */}
              {customPresets.map((preset) => (
                <div key={preset.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => handleCustomPresetSelect(preset)}
                    className={`rounded-lg border px-3 py-1.5 pr-7 text-sm font-medium transition-all ${
                      activePreset === `custom:${preset.id}`
                        ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900"
                        : "border-transparent"
                    }`}
                    style={{
                      backgroundColor: preset.light.profileContainerColor,
                      color: preset.light.profileTextColor,
                    }}
                    aria-pressed={activePreset === `custom:${preset.id}`}
                    data-testid={`custom-preset-${preset.name}`}
                  >
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePreset(preset.id);
                    }}
                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] leading-none text-white group-hover:flex"
                    aria-label={`Delete ${preset.name} preset`}
                    data-testid={`delete-preset-${preset.name}`}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Hidden form inputs — always rendered for form submission */}
      {THEME_COLOR_FIELDS.map((field) => (
        <input key={field} type="hidden" name={field} value={colors[field]} />
      ))}
    </div>
  );
}
