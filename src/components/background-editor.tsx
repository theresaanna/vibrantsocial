"use client";

import { useState, useCallback, useRef, useId, useEffect } from "react";
import type { BackgroundDefinition } from "@/lib/profile-backgrounds";
import {
  VALID_BG_ATTACHMENT,
  VALID_BG_POSITION,
  getDefaultsForBackground,
} from "@/lib/profile-backgrounds";

const BG_REPEAT_OPTIONS = [
  { value: "repeat", label: "Repeat Both" },
  { value: "repeat-x", label: "Repeat Horizontal" },
  { value: "repeat-y", label: "Repeat Vertical" },
  { value: "no-repeat", label: "No Repeat" },
] as const;

const BG_SIZE_OPTIONS = [
  { value: "auto", label: "None" },
  { value: "100% 100%", label: "Stretch" },
] as const;

import { PremiumCrown } from "./premium-crown";

interface BackgroundEditorProps {
  backgrounds: BackgroundDefinition[];
  premiumBackgrounds: BackgroundDefinition[];
  initialBackground: {
    profileBgImage: string | null;
    profileBgRepeat: string | null;
    profileBgAttachment: string | null;
    profileBgSize: string | null;
    profileBgPosition: string | null;
  };
  isPremium: boolean;
  userEmail?: string | null;
  containerOpacity?: number;
  onContainerOpacityChange?: (opacity: number) => void;
  onChange?: () => void;
  onBackgroundChange?: (bg: {
    image: string | null;
    repeat: string;
    attachment: string;
    size: string;
    position: string;
  }) => void;
  /** Fires when a new background image is selected (not on setting changes). */
  onBackgroundSelected?: (imageUrl: string | null) => void;
  /** Background settings pushed from parent (e.g. theme import). */
  externalBackground?: {
    image: string | null;
    repeat: string;
    attachment: string;
    size: string;
    position: string;
  } | null;
  /** When true, skip the collapsible wrapper — content is managed by a parent. */
  embedded?: boolean;
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
  const [hoveredBg, setHoveredBg] = useState<BackgroundDefinition | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const handleMouseEnter = useCallback((bg: BackgroundDefinition, e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const btnRect = btn.getBoundingClientRect();
    setPopoverPos({
      top: btnRect.bottom + 8,
      left: btnRect.left + btnRect.width / 2,
    });
    setHoveredBg(bg);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredBg(null);
    setPopoverPos(null);
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      {backgrounds.map((bg) => (
        <button
          key={bg.id}
          type="button"
          onClick={() => onSelect(bg)}
          onMouseEnter={(e) => handleMouseEnter(bg, e)}
          onMouseLeave={handleMouseLeave}
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
      {hoveredBg && popoverPos && (
        <div
          className="pointer-events-none fixed z-[9999] h-40 w-64 -translate-x-1/2 overflow-hidden rounded-xl border border-zinc-200 shadow-lg dark:border-zinc-700"
          style={{
            top: popoverPos.top,
            left: popoverPos.left,
            backgroundImage: `url(${hoveredBg.src})`,
            backgroundRepeat: getDefaultsForBackground(hoveredBg).repeat,
            backgroundSize: getDefaultsForBackground(hoveredBg).size,
            backgroundPosition: getDefaultsForBackground(hoveredBg).position,
          }}
        >
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
            <p className="text-xs font-medium text-white">{hoveredBg.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function BackgroundEditor({
  backgrounds,
  premiumBackgrounds,
  initialBackground,
  isPremium,
  userEmail,
  containerOpacity,
  onContainerOpacityChange,
  onChange,
  onBackgroundChange,
  onBackgroundSelected,
  externalBackground = null,
  embedded = false,
}: BackgroundEditorProps) {
  const [bgImage, setBgImage] = useState(initialBackground.profileBgImage);
  const [bgRepeat, setBgRepeat] = useState(initialBackground.profileBgRepeat ?? "no-repeat");
  const [bgAttachment, setBgAttachment] = useState(initialBackground.profileBgAttachment ?? "scroll");
  const [bgSize, setBgSize] = useState(initialBackground.profileBgSize ?? "contain");
  const [bgPosition, setBgPosition] = useState(initialBackground.profileBgPosition ?? "center");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentId = useId();

  // Sync background settings pushed from parent (e.g. theme import)
  useEffect(() => {
    if (externalBackground) {
      setBgImage(externalBackground.image);
      setBgRepeat(externalBackground.repeat);
      setBgAttachment(externalBackground.attachment);
      setBgSize(externalBackground.size);
      setBgPosition(externalBackground.position);
    }
  }, [externalBackground]);

  // Notify parent of live background changes for real-time preview
  useEffect(() => {
    onBackgroundChange?.({
      image: bgImage,
      repeat: bgRepeat,
      attachment: bgAttachment,
      size: bgSize,
      position: bgPosition,
    });
  }, [bgImage, bgRepeat, bgAttachment, bgSize, bgPosition, onBackgroundChange]);

  const isCustomUpload = bgImage?.includes("blob.vercel-storage.com") ?? false;

  const handlePresetSelect = useCallback(
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
        setBgSize("contain");
        setBgPosition("center");
        setBgAttachment("scroll");
      }
      setError(null);
      onChange?.();
      onBackgroundSelected?.(bg?.src ?? null);
    },
    [onChange, onBackgroundSelected]
  );

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/profile-background", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Upload failed");
          return;
        }

        const { url } = await res.json();
        setBgImage(url);
        onChange?.();
        onBackgroundSelected?.(url);
      } catch {
        setError("Upload failed");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [onChange]
  );

  const handleRemoveCustom = useCallback(async () => {
    setUploading(true);
    try {
      await fetch("/api/profile-background", { method: "DELETE" });
      setBgImage(null);
      onChange?.();
    } catch {
      setError("Failed to remove background");
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  const handleSettingChange = useCallback(
    (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      onChange?.();
    },
    [onChange]
  );

  const content = (
      <div id={contentId} className={embedded ? "space-y-4" : "space-y-4 px-4 pb-4"}>

      {embedded && (
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Background
        </h3>
      )}

      {/* Custom upload — premium only */}
      <div className="relative space-y-2">
        <PremiumCrown href="/premium" />
        <div className={`flex flex-wrap items-center gap-2 ${!isPremium ? "pointer-events-none opacity-50" : ""}`}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !isPremium}
            className="rounded-lg bg-fuchsia-50 px-3 py-1.5 text-sm font-medium text-fuchsia-600 transition-colors hover:bg-fuchsia-100 disabled:opacity-50 dark:bg-fuchsia-900/20 dark:text-fuchsia-400 dark:hover:bg-fuchsia-900/30"
          >
            {uploading ? "Uploading..." : "Upload Custom Background"}
          </button>
          {isCustomUpload && (
            <button
              type="button"
              onClick={handleRemoveCustom}
              disabled={uploading}
              className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              Remove Custom
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
          onChange={handleUpload}
          className="hidden"
        />
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>

      {/* Display settings — shown when a background is selected */}
      {bgImage && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Repeat</span>
            <select
              value={bgRepeat}
              onChange={handleSettingChange(setBgRepeat)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {BG_REPEAT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Movement</span>
            <select
              value={bgAttachment}
              onChange={handleSettingChange(setBgAttachment)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {VALID_BG_ATTACHMENT.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Stretch</span>
            <select
              value={bgSize === "cover" || bgSize === "contain" ? "100% 100%" : bgSize}
              onChange={handleSettingChange(setBgSize)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {BG_SIZE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Position</span>
            <select
              value={bgPosition}
              onChange={handleSettingChange(setBgPosition)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {VALID_BG_POSITION.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Live preview */}
      {bgImage && (
        <div
          className="h-32 w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundRepeat: bgRepeat,
            backgroundSize: bgSize,
            backgroundPosition: bgPosition,
          }}
        />
      )}

      {/* Preset backgrounds */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handlePresetSelect(null)}
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
          onSelect={handlePresetSelect}
        />
      </div>

      {/* Premium backgrounds */}
      {premiumBackgrounds.length > 0 && (
        <div className="space-y-2">
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
              onSelect={handlePresetSelect}
              disabled={!isPremium}
            />
          </div>
        </div>
      )}

      </div>
  );

  const hiddenInputs = (
    <>
      <input type="hidden" name="profileBgImage" value={bgImage ?? ""} />
      <input type="hidden" name="profileBgRepeat" value={bgImage ? bgRepeat : ""} />
      <input type="hidden" name="profileBgAttachment" value={bgImage ? bgAttachment : ""} />
      <input type="hidden" name="profileBgSize" value={bgImage ? bgSize : ""} />
      <input type="hidden" name="profileBgPosition" value={bgImage ? bgPosition : ""} />
    </>
  );

  if (embedded) {
    return (
      <>
        {content}
        {hiddenInputs}
      </>
    );
  }

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
          Background
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

      {isOpen && content}

      {hiddenInputs}
    </div>
  );
}
