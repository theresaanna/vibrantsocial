"use client";

import { useState, useCallback, useId } from "react";
import {
  type SparklefallConfig,
  SPARKLEFALL_PRESETS,
  SPARKLEFALL_DEFAULTS,
  parseJsonArray,
} from "@/lib/sparklefall-presets";
import { PremiumCrown } from "./premium-crown";

interface SparkleEditorProps {
  initialConfig: SparklefallConfig;
  isPremium: boolean;
  userEmail?: string | null;
  onChange: () => void;
}

export function SparkleEditor({
  initialConfig,
  isPremium,
  userEmail,
  onChange,
}: SparkleEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  const [enabled, setEnabled] = useState(initialConfig.sparklefallEnabled);
  const [activePreset, setActivePreset] = useState<string | null>(
    initialConfig.sparklefallPreset
  );
  const [customSparkles, setCustomSparkles] = useState(
    initialConfig.sparklefallSparkles
      ? (parseJsonArray(initialConfig.sparklefallSparkles)?.join(" ") ?? "")
      : ""
  );
  const [customColors, setCustomColors] = useState(
    initialConfig.sparklefallColors
      ? (parseJsonArray(initialConfig.sparklefallColors)?.join(", ") ?? "")
      : ""
  );
  const [interval, setInterval_] = useState(
    initialConfig.sparklefallInterval ?? SPARKLEFALL_DEFAULTS.interval
  );
  const [wind, setWind] = useState(
    initialConfig.sparklefallWind ?? SPARKLEFALL_DEFAULTS.wind
  );
  const [maxSparkles, setMaxSparkles] = useState(
    initialConfig.sparklefallMaxSparkles ?? SPARKLEFALL_DEFAULTS.maxSparkles
  );
  const [minSize, setMinSize] = useState(
    initialConfig.sparklefallMinSize ?? SPARKLEFALL_DEFAULTS.minSize
  );
  const [maxSize, setMaxSize] = useState(
    initialConfig.sparklefallMaxSize ?? SPARKLEFALL_DEFAULTS.maxSize
  );

  const handlePresetSelect = useCallback(
    (presetName: string) => {
      setActivePreset(presetName);
      setCustomSparkles("");
      onChange();
    },
    [onChange]
  );

  const getSparklesJson = (): string => {
    if (customSparkles.trim()) {
      const chars = [...customSparkles.trim()].filter((c) => c.trim());
      return JSON.stringify(chars);
    }
    if (activePreset && SPARKLEFALL_PRESETS[activePreset]) {
      return JSON.stringify(SPARKLEFALL_PRESETS[activePreset].sparkles);
    }
    return JSON.stringify(SPARKLEFALL_PRESETS.default.sparkles);
  };

  const getColorsJson = (): string => {
    if (!customColors.trim()) return "";
    const colors = customColors
      .split(",")
      .map((c) => c.trim())
      .filter((c) => /^#[0-9a-fA-F]{3,6}$/.test(c));
    return colors.length > 0 ? JSON.stringify(colors) : "";
  };

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
          Raining Emoji
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
          <div className="relative">
            {!isPremium && <PremiumCrown />}
            <div
              className={
                !isPremium ? "pointer-events-none opacity-50" : undefined
              }
            >
              {/* Enable toggle */}
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => {
                    setEnabled(e.target.checked);
                    onChange();
                  }}
                  disabled={!isPremium}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                />
                Enable raining emoji on your profile
              </label>

              {enabled && (
                <div className="mt-4 space-y-4">
                  {/* Preset buttons */}
                  <div>
                    <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Presets
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(SPARKLEFALL_PRESETS).map(
                        ([name, preset]) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => handlePresetSelect(name)}
                            className={`rounded-lg border px-3 py-1.5 text-sm transition-all ${
                              activePreset === name
                                ? "border-blue-500 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900"
                                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-600 dark:hover:border-zinc-500"
                            }`}
                            aria-pressed={activePreset === name}
                          >
                            <span className="mr-1">{preset.emoji}</span>
                            {preset.label}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Custom sparkle characters */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Custom characters (overrides preset)
                    </label>
                    <input
                      type="text"
                      value={customSparkles}
                      onChange={(e) => {
                        setCustomSparkles(e.target.value);
                        if (e.target.value.trim()) setActivePreset(null);
                        onChange();
                      }}
                      placeholder="e.g. 🌈 💖 ⭐"
                      className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-600 dark:text-zinc-100"
                    />
                  </div>

                  {/* Physics controls */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Physics
                    </p>

                    {/* Spawn Interval */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-zinc-600 dark:text-zinc-400">
                          Spawn Interval
                        </label>
                        <span className="text-xs tabular-nums text-zinc-500">
                          {interval}ms
                        </span>
                      </div>
                      <input
                        type="range"
                        min={100}
                        max={3000}
                        step={50}
                        value={interval}
                        onChange={(e) => {
                          setInterval_(Number(e.target.value));
                          onChange();
                        }}
                        className="w-full accent-blue-500"
                      />
                    </div>

                    {/* Wind */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-zinc-600 dark:text-zinc-400">
                          Wind Effect
                        </label>
                        <span className="text-xs tabular-nums text-zinc-500">
                          {wind.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-1}
                        max={1}
                        step={0.1}
                        value={wind}
                        onChange={(e) => {
                          setWind(Number(e.target.value));
                          onChange();
                        }}
                        className="w-full accent-blue-500"
                      />
                    </div>

                    {/* Max Sparkles */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-zinc-600 dark:text-zinc-400">
                          Max Sparkles
                        </label>
                        <span className="text-xs tabular-nums text-zinc-500">
                          {maxSparkles}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={200}
                        step={5}
                        value={maxSparkles}
                        onChange={(e) => {
                          setMaxSparkles(Number(e.target.value));
                          onChange();
                        }}
                        className="w-full accent-blue-500"
                      />
                    </div>

                    {/* Size Range */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-zinc-600 dark:text-zinc-400">
                            Min Size
                          </label>
                          <span className="text-xs tabular-nums text-zinc-500">
                            {minSize}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          step={1}
                          value={minSize}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setMinSize(v);
                            if (v > maxSize) setMaxSize(v);
                            onChange();
                          }}
                          className="w-full accent-blue-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-zinc-600 dark:text-zinc-400">
                            Max Size
                          </label>
                          <span className="text-xs tabular-nums text-zinc-500">
                            {maxSize}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          step={1}
                          value={maxSize}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setMaxSize(v);
                            if (v < minSize) setMinSize(v);
                            onChange();
                          }}
                          className="w-full accent-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Custom colors */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Custom colors (leave empty for emoji defaults)
                    </label>
                    <input
                      type="text"
                      value={customColors}
                      onChange={(e) => {
                        setCustomColors(e.target.value);
                        onChange();
                      }}
                      placeholder="e.g. #ff0000, #00ff00, #0000ff"
                      className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-600 dark:text-zinc-100"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden form inputs */}
      <input type="hidden" name="sparklefallEnabled" value={String(enabled)} />
      <input
        type="hidden"
        name="sparklefallPreset"
        value={activePreset ?? ""}
      />
      <input
        type="hidden"
        name="sparklefallSparkles"
        value={enabled ? getSparklesJson() : ""}
      />
      <input
        type="hidden"
        name="sparklefallColors"
        value={enabled ? getColorsJson() : ""}
      />
      <input
        type="hidden"
        name="sparklefallInterval"
        value={String(interval)}
      />
      <input type="hidden" name="sparklefallWind" value={String(wind)} />
      <input
        type="hidden"
        name="sparklefallMaxSparkles"
        value={String(maxSparkles)}
      />
      <input type="hidden" name="sparklefallMinSize" value={String(minSize)} />
      <input type="hidden" name="sparklefallMaxSize" value={String(maxSize)} />
    </div>
  );
}
