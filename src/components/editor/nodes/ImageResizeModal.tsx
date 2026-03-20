"use client";

import { useState, useRef, useEffect } from "react";
import { Modal } from "../ui/Modal";

type Unit = "px" | "%";

interface ImageResizeModalProps {
  initialWidth: number;
  initialHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  /** Width of the editor content area in px, used for % calculations */
  editorWidth: number;
  onApply: (w: number, h: number) => void;
  onClose: () => void;
}

export function ImageResizeModal({
  initialWidth,
  initialHeight,
  naturalWidth,
  naturalHeight,
  editorWidth,
  onApply,
  onClose,
}: ImageResizeModalProps) {
  const [unit, setUnit] = useState<Unit>("px");
  const [w, setW] = useState(String(initialWidth));
  const [h, setH] = useState(String(initialHeight));
  const [locked, setLocked] = useState(true);
  const [error, setError] = useState("");
  const widthRef = useRef<HTMLInputElement>(null);

  const aspectRatio = naturalWidth / naturalHeight;

  // Focus width input on mount
  useEffect(() => {
    widthRef.current?.select();
  }, []);

  // Convert between px and % when switching units
  const handleUnitChange = (newUnit: Unit) => {
    if (newUnit === unit) return;
    const wNum = Number(w);
    const hNum = Number(h);

    if (newUnit === "%") {
      // px → %
      const wPct = editorWidth > 0 ? Math.round((wNum / editorWidth) * 100) : 100;
      const hPct = editorWidth > 0 ? Math.round((hNum / (editorWidth / aspectRatio)) * 100) : 100;
      setW(String(wPct));
      setH(String(hPct));
    } else {
      // % → px
      const wPx = Math.round((wNum / 100) * editorWidth);
      const hPx = Math.round(wPx / aspectRatio);
      setW(String(wPx));
      setH(String(hPx));
    }
    setUnit(newUnit);
    setError("");
  };

  const handleWidthChange = (val: string) => {
    setW(val);
    setError("");
    const num = Number(val);
    if (locked && val !== "" && Number.isFinite(num) && num > 0) {
      if (unit === "px") {
        setH(String(Math.round(num / aspectRatio)));
      } else {
        // In % mode, keep same % for both when locked
        setH(val);
      }
    }
  };

  const handleHeightChange = (val: string) => {
    setH(val);
    setError("");
    const num = Number(val);
    if (locked && val !== "" && Number.isFinite(num) && num > 0) {
      if (unit === "px") {
        setW(String(Math.round(num * aspectRatio)));
      } else {
        setW(val);
      }
    }
  };

  const applyPreset = (pct: number) => {
    const pxW = Math.round((pct / 100) * editorWidth);
    const pxH = Math.round(pxW / aspectRatio);
    if (unit === "%") {
      setW(String(pct));
      setH(String(pct));
    } else {
      setW(String(pxW));
      setH(String(pxH));
    }
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedW = Number(w);
    const parsedH = Number(h);

    if (
      w.trim() === "" ||
      h.trim() === "" ||
      !Number.isFinite(parsedW) ||
      !Number.isFinite(parsedH) ||
      parsedW < 1 ||
      parsedH < 1
    ) {
      setError("Width and height must be positive numbers.");
      return;
    }

    let finalW: number;
    let finalH: number;

    if (unit === "%") {
      finalW = Math.round((parsedW / 100) * editorWidth);
      finalH = Math.round(finalW / aspectRatio);
    } else {
      finalW = Math.round(parsedW);
      finalH = Math.round(parsedH);
    }

    if (finalW < 10 || finalH < 10) {
      setError("Minimum size is 10 x 10 pixels.");
      return;
    }

    onApply(finalW, finalH);
  };

  const unitToggleClass = (u: Unit) =>
    `flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      unit === u
        ? "bg-blue-600 text-white"
        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
    }`;

  const presetBtnClass =
    "rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:active:bg-zinc-600 transition-colors";

  return (
    <Modal title="Resize Image" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Unit toggle */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Unit</span>
          <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-600">
            <button
              type="button"
              onClick={() => handleUnitChange("px")}
              data-testid="unit-toggle-px"
              className={unitToggleClass("px")}
            >
              px
            </button>
            <button
              type="button"
              onClick={() => handleUnitChange("%")}
              data-testid="unit-toggle-pct"
              className={unitToggleClass("%")}
            >
              %
            </button>
          </div>
        </div>

        {/* Width / Height inputs */}
        <div className="flex items-end gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Width
            <input
              ref={widthRef}
              type="text"
              inputMode="numeric"
              value={w}
              onChange={(e) => handleWidthChange(e.target.value)}
              data-testid="resize-width-input"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>

          <button
            type="button"
            onClick={() => setLocked(!locked)}
            data-testid="resize-aspect-lock"
            title={locked ? "Unlock aspect ratio" : "Lock aspect ratio"}
            className={`mb-1 flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              locked
                ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            }`}
          >
            {locked ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </svg>
            )}
          </button>

          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Height
            <input
              type="text"
              inputMode="numeric"
              value={h}
              onChange={(e) => handleHeightChange(e.target.value)}
              data-testid="resize-height-input"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
        </div>

        {/* Presets */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Presets</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => applyPreset(25)} data-testid="preset-25" className={presetBtnClass}>
              25%
            </button>
            <button type="button" onClick={() => applyPreset(50)} data-testid="preset-50" className={presetBtnClass}>
              50%
            </button>
            <button type="button" onClick={() => applyPreset(100)} data-testid="preset-100" className={presetBtnClass}>
              100%
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p data-testid="resize-error" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="resize-apply-button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </form>
    </Modal>
  );
}
