"use client";

import { useState, useCallback, useId, useTransition, useRef } from "react";
import {
  type ProfileThemeColors,
  type CustomPresetData,
  PROFILE_THEME_PRESETS,
  THEME_COLOR_FIELDS,
  generateAdaptiveTheme,
} from "@/lib/profile-themes";
import type { BackgroundDefinition } from "@/lib/profile-backgrounds";
import {
  generateTheme,
  saveCustomPreset,
  deleteCustomPreset,
} from "@/app/profile/generate-theme-action";
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
  customPresets?: CustomPresetData[];
  backgrounds?: BackgroundDefinition[];
}

export function ThemeEditor({
  initialColors,
  username,
  displayName,
  bio,
  avatarSrc,
  onChange,
  isPremium = true,
  userEmail,
  customPresets: initialCustomPresets = [],
  backgrounds = [],
}: ThemeEditorProps) {
  const defaultPreset = PROFILE_THEME_PRESETS.default;
  const [colors, setColors] = useState<ProfileThemeColors>({
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
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  // AI generation state
  const [selectedBgImage, setSelectedBgImage] = useState<string | null>(null);
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveCurrentName, setSaveCurrentName] = useState("");
  const [showSaveCurrent, setShowSaveCurrent] = useState(false);
  const [saveCurrentError, setSaveCurrentError] = useState<string | null>(null);

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

  const handleBgSelect = useCallback((bg: BackgroundDefinition) => {
    setSelectedBgImage(bg.src);
    setGenerationError(null);
  }, []);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/profile-background", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          setUploadError(data.error || "Upload failed");
          return;
        }

        const { url } = await res.json();
        setSelectedBgImage(url);
        setGenerationError(null);
      } catch {
        setUploadError("Upload failed");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    []
  );

  const handleGenerate = useCallback(() => {
    if (!selectedBgImage || isGenerating) return;
    setGenerationError(null);
    setGeneratedTheme(null);

    startGenerateTransition(async () => {
      const result = await generateTheme(selectedBgImage);
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
  }, [selectedBgImage, isGenerating, onChange]);

  const handleSavePreset = useCallback(() => {
    if (!generatedTheme || !presetName.trim() || isSaving) return;

    startSaveTransition(async () => {
      const result = await saveCustomPreset({
        name: presetName.trim(),
        imageUrl: selectedBgImage ?? "",
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
  }, [generatedTheme, presetName, selectedBgImage, isSaving]);

  const handleSaveCurrentTheme = useCallback(() => {
    if (!saveCurrentName.trim() || isSaving) return;
    setSaveCurrentError(null);

    const { light, dark } = generateAdaptiveTheme(colors);

    startSaveTransition(async () => {
      const result = await saveCustomPreset({
        name: saveCurrentName.trim(),
        imageUrl: "",
        light,
        dark,
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

  const isCustomUpload = selectedBgImage?.includes("blob.vercel-storage.com") ?? false;

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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
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

            {/* Custom AI preset pills */}
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

          {/* AI theme from background — premium only */}
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
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Generate theme from background
              </label>

              {/* Background selection grid */}
              <div className="flex flex-wrap gap-2">
                {backgrounds.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => handleBgSelect(bg)}
                    title={bg.name}
                    disabled={!isPremium}
                    className={`h-12 w-12 overflow-hidden rounded-lg border transition-all ${
                      selectedBgImage === bg.src
                        ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                    data-testid={`theme-bg-${bg.id}`}
                  >
                    <img
                      src={bg.thumbSrc}
                      alt={bg.name}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>

              {/* Upload custom background for theme generation */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !isPremium}
                  className="rounded-lg bg-fuchsia-50 px-3 py-1.5 text-sm font-medium text-fuchsia-600 transition-colors hover:bg-fuchsia-100 disabled:opacity-50 dark:bg-fuchsia-900/20 dark:text-fuchsia-400 dark:hover:bg-fuchsia-900/30"
                >
                  {uploading ? "Uploading..." : "Upload Background"}
                </button>
                {isCustomUpload && selectedBgImage && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Custom image selected
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                onChange={handleUpload}
                className="hidden"
              />
              {uploadError && (
                <p className="text-xs text-red-500">{uploadError}</p>
              )}

              {/* Preview of selected background */}
              {selectedBgImage && (
                <div
                  className="h-20 w-full rounded-lg border border-zinc-200 bg-cover bg-center dark:border-zinc-700"
                  style={{ backgroundImage: `url(${selectedBgImage})` }}
                />
              )}

              {/* Generate button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!isPremium || isGenerating || !selectedBgImage}
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
