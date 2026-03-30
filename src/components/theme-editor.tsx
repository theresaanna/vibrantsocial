"use client";

import { useState, useCallback, useId, useTransition, useRef } from "react";
import {
  type ProfileThemeColors,
  type CustomPresetData,
  PROFILE_THEME_PRESETS,
  THEME_COLOR_FIELDS,
} from "@/lib/profile-themes";
import type { BackgroundDefinition } from "@/lib/profile-backgrounds";
import {
  VALID_BG_REPEAT,
  VALID_BG_ATTACHMENT,
  VALID_BG_SIZE,
  VALID_BG_POSITION,
  getDefaultsForBackground,
} from "@/lib/profile-backgrounds";
import {
  generateTheme,
  saveCustomPreset,
  deleteCustomPreset,
} from "@/app/theme/generate-theme-action";
import { ThemePreview } from "./theme-preview";
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
  backgrounds?: BackgroundDefinition[];
  premiumBackgrounds?: BackgroundDefinition[];
  initialBackground?: {
    profileBgImage: string | null;
    profileBgRepeat: string | null;
    profileBgAttachment: string | null;
    profileBgSize: string | null;
    profileBgPosition: string | null;
  };
}

function BackgroundGrid({
  backgrounds,
  selectedSrc,
  onSelect,
  disabled,
}: {
  backgrounds: BackgroundDefinition[];
  selectedSrc: string | null;
  onSelect: (bg: BackgroundDefinition) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {backgrounds.map((bg) => (
        <button
          key={bg.id}
          type="button"
          onClick={() => onSelect(bg)}
          title={bg.name}
          disabled={disabled}
          className={`h-12 w-12 overflow-hidden rounded-lg border transition-all ${
            selectedSrc === bg.src
              ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900"
              : "border-zinc-200 dark:border-zinc-700"
          } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <img
            src={bg.thumbSrc}
            alt={bg.name}
            className="h-full w-full object-cover"
          />
        </button>
      ))}
    </>
  );
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
  backgrounds = [],
  premiumBackgrounds = [],
  initialBackground,
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
  const [showPreview, setShowPreview] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  // Background state
  const [bgImage, setBgImage] = useState(initialBackground?.profileBgImage ?? null);
  const [bgRepeat, setBgRepeat] = useState(initialBackground?.profileBgRepeat ?? "no-repeat");
  const [bgAttachment, setBgAttachment] = useState(initialBackground?.profileBgAttachment ?? "scroll");
  const [bgSize, setBgSize] = useState(initialBackground?.profileBgSize ?? "cover");
  const [bgPosition, setBgPosition] = useState(initialBackground?.profileBgPosition ?? "center");
  const [bgUploading, setBgUploading] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  // AI generation state
  const [isGenerating, startGenerateTransition] = useTransition();
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedTheme, setGeneratedTheme] = useState<{
    name: string;
    light: ProfileThemeColors;
    dark: ProfileThemeColors;
  } | null>(null);
  const [presetName, setPresetName] = useState("");
  const [isSaving, startSaveTransition] = useTransition();
  const [customPresets, setCustomPresets] =
    useState<CustomPresetData[]>(initialCustomPresets);
  const [saveCurrentName, setSaveCurrentName] = useState("");
  const [showSaveCurrent, setShowSaveCurrent] = useState(false);
  const [saveCurrentError, setSaveCurrentError] = useState<string | null>(null);

  const isCustomUpload = bgImage?.includes("blob.vercel-storage.com") ?? false;

  // Notify parent of live color changes for real-time preview
  useEffect(() => {
    onColorsChange?.(colors);
  }, [colors, onColorsChange]);

  // --- Theme handlers ---

  const handlePresetSelect = useCallback(
    (presetName: string) => {
      setColors(PROFILE_THEME_PRESETS[presetName]);
      setActivePreset(presetName);
      setGeneratedTheme(null);
      onChange?.();
    },
    [onChange]
  );

  const handleCustomPresetSelect = useCallback(
    (preset: CustomPresetData) => {
      setColors(preset.light);
      setActivePreset(`custom:${preset.id}`);
      setGeneratedTheme(null);
      onChange?.();
    },
    [onChange]
  );

  // --- Background handlers ---

  const handleBgSelect = useCallback(
    (bg: BackgroundDefinition | null) => {
      if (bg) {
        setBgImage(bg.src);
        const defaults = getDefaultsForBackground(bg);
        setBgRepeat(defaults.repeat);
        setBgSize(defaults.size);
        setBgPosition(defaults.position);
        setBgAttachment(defaults.attachment);
      } else {
        setBgImage(null);
        setBgRepeat("no-repeat");
        setBgSize("cover");
        setBgPosition("center");
        setBgAttachment("scroll");
      }
      setBgError(null);
      setGenerationError(null);
      onChange?.();
    },
    [onChange]
  );

  const handleBgUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setBgUploading(true);
      setBgError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/profile-background", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          setBgError(data.error || "Upload failed");
          return;
        }

        const { url } = await res.json();
        setBgImage(url);
        setGenerationError(null);
        onChange?.();
      } catch {
        setBgError("Upload failed");
      } finally {
        setBgUploading(false);
        if (bgFileInputRef.current) bgFileInputRef.current.value = "";
      }
    },
    [onChange]
  );

  const handleRemoveCustomBg = useCallback(async () => {
    setBgUploading(true);
    try {
      await fetch("/api/profile-background", { method: "DELETE" });
      setBgImage(null);
      onChange?.();
    } catch {
      setBgError("Failed to remove background");
    } finally {
      setBgUploading(false);
    }
  }, [onChange]);

  const handleBgSettingChange = useCallback(
    (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      onChange?.();
    },
    [onChange]
  );

  // --- AI theme generation ---

  const handleGenerate = useCallback(() => {
    if (!bgImage || isGenerating) return;
    setGenerationError(null);
    setGeneratedTheme(null);

    startGenerateTransition(async () => {
      const result = await generateTheme(bgImage);
      if (result.success && result.light && result.dark && result.name) {
        setColors(result.light);
        setActivePreset(null);
        setGeneratedTheme({
          name: result.name,
          light: result.light,
          dark: result.dark,
        });
        setPresetName(result.name);
        onChange?.();
      } else {
        setGenerationError(result.error ?? "Failed to generate theme");
      }
    });
  }, [bgImage, isGenerating, onChange]);

  const handleSavePreset = useCallback(() => {
    if (!generatedTheme || !presetName.trim() || isSaving) return;

    startSaveTransition(async () => {
      const result = await saveCustomPreset({
        name: presetName.trim(),
        imageUrl: bgImage ?? "",
        light: generatedTheme.light,
        dark: generatedTheme.dark,
      });
      if (result.success && result.preset) {
        setCustomPresets((prev) => {
          const existing = prev.findIndex((p) => p.name === result.preset!.name);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = result.preset!;
            return updated;
          }
          return [...prev, result.preset!];
        });
        setActivePreset(`custom:${result.preset.id}`);
        setGeneratedTheme(null);
      } else {
        setGenerationError(result.error ?? "Failed to save preset");
      }
    });
  }, [generatedTheme, presetName, bgImage, isSaving]);

  const handleSaveCurrentTheme = useCallback(() => {
    if (!saveCurrentName.trim() || isSaving) return;
    setSaveCurrentError(null);

    startSaveTransition(async () => {
      const result = await saveCustomPreset({
        name: saveCurrentName.trim(),
        imageUrl: "",
        light: colors,
        dark: colors,
      });
      if (result.success && result.preset) {
        setCustomPresets((prev) => {
          const existing = prev.findIndex((p) => p.name === result.preset!.name);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = result.preset!;
            return updated;
          }
          return [...prev, result.preset!];
        });
        setActivePreset(`custom:${result.preset.id}`);
        setShowSaveCurrent(false);
        setSaveCurrentName("");
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
          Theme {"&"} Background
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
          {/* Background selection */}
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Background
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleBgSelect(null)}
                className={`flex h-12 w-12 items-center justify-center rounded-lg border text-xs transition-all ${
                  bgImage === null
                    ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900"
                    : "border-zinc-200 dark:border-zinc-700"
                } bg-zinc-50 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500`}
              >
                None
              </button>
              <BackgroundGrid
                backgrounds={backgrounds}
                selectedSrc={bgImage}
                onSelect={handleBgSelect}
              />
            </div>

            {/* Premium backgrounds */}
            {premiumBackgrounds.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <PremiumCrown href="/premium" inline />
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Premium Backgrounds
                  </span>
                </div>
                <div className={`flex flex-wrap gap-2 ${!isPremium ? "pointer-events-none opacity-50" : ""}`}>
                  <BackgroundGrid
                    backgrounds={premiumBackgrounds}
                    selectedSrc={bgImage}
                    onSelect={handleBgSelect}
                    disabled={!isPremium}
                  />
                </div>
              </div>
            )}

            {/* Custom upload — premium only */}
            <div className="relative mt-3 space-y-2">
              <PremiumCrown href="/premium" />
              <div className={`flex flex-wrap items-center gap-2 ${!isPremium ? "pointer-events-none opacity-50" : ""}`}>
                <button
                  type="button"
                  onClick={() => bgFileInputRef.current?.click()}
                  disabled={bgUploading || !isPremium}
                  className="rounded-lg bg-fuchsia-50 px-3 py-1.5 text-sm font-medium text-fuchsia-600 transition-colors hover:bg-fuchsia-100 disabled:opacity-50 dark:bg-fuchsia-900/20 dark:text-fuchsia-400 dark:hover:bg-fuchsia-900/30"
                >
                  {bgUploading ? "Uploading..." : "Upload Custom Background"}
                </button>
                {isCustomUpload && (
                  <button
                    type="button"
                    onClick={handleRemoveCustomBg}
                    disabled={bgUploading}
                    className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  >
                    Remove Custom
                  </button>
                )}
              </div>
              <input
                ref={bgFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                onChange={handleBgUpload}
                className="hidden"
              />
              {bgError && (
                <p className="text-xs text-red-500">{bgError}</p>
              )}
            </div>

            {/* Live preview */}
            {bgImage && (
              <div
                className="mt-3 h-32 w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
                style={{
                  backgroundImage: `url(${bgImage})`,
                  backgroundRepeat: bgRepeat,
                  backgroundSize: bgSize,
                  backgroundPosition: bgPosition,
                }}
              />
            )}

            {/* Display settings */}
            {bgImage && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Repeat</span>
                  <select
                    value={bgRepeat}
                    onChange={handleBgSettingChange(setBgRepeat)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {VALID_BG_REPEAT.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Attachment</span>
                  <select
                    value={bgAttachment}
                    onChange={handleBgSettingChange(setBgAttachment)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {VALID_BG_ATTACHMENT.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Size</span>
                  <select
                    value={bgSize}
                    onChange={handleBgSettingChange(setBgSize)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {VALID_BG_SIZE.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Position</span>
                  <select
                    value={bgPosition}
                    onChange={handleBgSettingChange(setBgPosition)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {VALID_BG_POSITION.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          {/* Unsaved theme indicator + Preview button */}
          {hasUnsavedThemeChange && (
            <div
              className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-950"
              data-testid="unsaved-theme-indicator"
            >
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Theme changed — preview below or save your profile to apply
                </span>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                hasUnsavedThemeChange
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              Preview
            </button>
            {hasUnsavedThemeChange && (
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
            )}
          </div>

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

          {/* Generate theme from background — premium only */}
          {bgImage && (
            <div
              className="relative"
              data-testid={
                isPremium ? "ai-theme-generator" : "ai-theme-upgrade-prompt"
              }
            >
              <PremiumCrown href="/premium" />
              <div
                className={`space-y-3 ${!isPremium ? "pointer-events-none opacity-50" : ""}`}
              >
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!isPremium || isGenerating}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  data-testid="ai-generate-button"
                >
                  {isGenerating ? "Generating..." : "Generate Theme from Background"}
                </button>

                {generationError && (
                  <p
                    className="text-xs text-red-500"
                    data-testid="ai-generation-error"
                  >
                    {generationError}
                  </p>
                )}

                {/* Save as preset form */}
                {generatedTheme && (
                  <div
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                    data-testid="save-preset-form"
                  >
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Preset name"
                      className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-600 dark:text-zinc-100"
                      maxLength={30}
                      data-testid="preset-name-input"
                    />
                    <button
                      type="button"
                      onClick={handleSavePreset}
                      disabled={isSaving || !presetName.trim()}
                      className="rounded-lg bg-green-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                      data-testid="save-preset-button"
                    >
                      {isSaving ? "Saving..." : "Save Preset"}
                    </button>
                  </div>
                )}
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
      <input type="hidden" name="profileBgImage" value={bgImage ?? ""} />
      <input type="hidden" name="profileBgRepeat" value={bgImage ? bgRepeat : ""} />
      <input type="hidden" name="profileBgAttachment" value={bgImage ? bgAttachment : ""} />
      <input type="hidden" name="profileBgSize" value={bgImage ? bgSize : ""} />
      <input type="hidden" name="profileBgPosition" value={bgImage ? bgPosition : ""} />
    </div>
  );
}
