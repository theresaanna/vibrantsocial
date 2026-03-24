"use client";

import { useState, useCallback, useId, useTransition } from "react";
import {
  type ProfileThemeColors,
  type CustomPresetData,
  PROFILE_THEME_PRESETS,
  THEME_COLOR_FIELDS,
  isValidHexColor,
} from "@/lib/profile-themes";
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
  customPresets: initialCustomPresets = [],
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
  const [aiPrompt, setAiPrompt] = useState("");
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

  const handleColorChange = useCallback(
    (field: keyof ProfileThemeColors, value: string) => {
      setColors((prev) => ({ ...prev, [field]: value }));
      setActivePreset(null);
      onChange?.();
    },
    [onChange]
  );

  const handleGenerate = useCallback(() => {
    if (!aiPrompt.trim() || isGenerating) return;
    setGenerationError(null);
    setGeneratedTheme(null);

    startGenerateTransition(async () => {
      const result = await generateTheme(aiPrompt.trim());
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
  }, [aiPrompt, isGenerating, onChange]);

  const handleSavePreset = useCallback(() => {
    if (!generatedTheme || !presetName.trim() || isSaving) return;

    startSaveTransition(async () => {
      const result = await saveCustomPreset({
        name: presetName.trim(),
        prompt: aiPrompt,
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
  }, [generatedTheme, presetName, aiPrompt, isSaving]);

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

          {/* AI theme generator — premium only */}
          <div
            className="relative"
            data-testid={
              isPremium ? "ai-theme-generator" : "ai-theme-upgrade-prompt"
            }
          >
            <PremiumCrown href="/premium" />
            <div
              className={`space-y-2 ${!isPremium ? "pointer-events-none opacity-50" : ""}`}
            >
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Generate with AI
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                  placeholder="Describe a theme (e.g., cyberpunk neon, warm autumn)"
                  disabled={!isPremium || isGenerating}
                  className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-600 dark:text-zinc-100"
                  maxLength={200}
                  data-testid="ai-prompt-input"
                />
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!isPremium || isGenerating || !aiPrompt.trim()}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  data-testid="ai-generate-button"
                >
                  {isGenerating ? "Generating..." : "Generate"}
                </button>
              </div>

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

          {/* Individual color pickers — premium only */}
          <div
            className="relative"
            data-testid={
              isPremium
                ? "custom-color-pickers"
                : "custom-colors-upgrade-prompt"
            }
          >
            <PremiumCrown href="/premium" />
            <div
              className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${!isPremium ? "pointer-events-none opacity-50" : ""}`}
            >
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
