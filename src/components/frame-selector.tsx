"use client";

import { useState } from "react";
import { PROFILE_FRAMES, type FrameDefinition } from "@/lib/profile-frames";
import { FramedAvatar } from "./framed-avatar";
import { PremiumCrown } from "./premium-crown";

interface FrameSelectorProps {
  currentFrameId: string | null;
  avatarSrc: string | null;
  initial: string;
  isPremium: boolean;
  userEmail?: string | null;
  onSelect: (frameId: string | null) => void;
  onClose: () => void;
}

function FrameOption({
  frame,
  isSelected,
  avatarSrc,
  initial,
  onSelect,
}: {
  frame: FrameDefinition;
  isSelected: boolean;
  avatarSrc: string | null;
  initial: string;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(frame.id)}
      className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-all ${
        isSelected
          ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900"
          : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
      }`}
      aria-pressed={isSelected}
      data-testid={`frame-option-${frame.id}`}
    >
      <FramedAvatar src={avatarSrc} initial={initial} size={70} frameId={frame.id} />
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{frame.name}</span>
    </button>
  );
}

export function FrameSelector({
  currentFrameId,
  avatarSrc,
  initial,
  isPremium,
  userEmail,
  onSelect,
  onClose,
}: FrameSelectorProps) {
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(currentFrameId);

  const springFrames = PROFILE_FRAMES.filter((f) => f.category === "spring");
  const neonFrames = PROFILE_FRAMES.filter((f) => f.category === "neon");

  function handleSelect(frameId: string | null) {
    setSelectedFrameId(frameId);
    onSelect(frameId);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="frame-selector-backdrop"
    >
      <div className="w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900" style={{ maxHeight: "90vh" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Profile Frame
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            data-testid="frame-selector-close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Live preview */}
        <div className="mb-6 flex justify-center" data-testid="frame-preview">
          <FramedAvatar
            src={avatarSrc}
            initial={initial}
            size={120}
            frameId={selectedFrameId}
          />
        </div>

        <div className={`relative space-y-4 ${!isPremium ? "pointer-events-none opacity-50" : ""}`} data-testid={!isPremium ? "frame-upgrade-prompt" : undefined}>
          <PremiumCrown />
          {/* None option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            disabled={!isPremium}
            className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
              selectedFrameId === null
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            aria-pressed={selectedFrameId === null}
            data-testid="frame-option-none"
          >
            No Frame
          </button>

          {/* Spring frames */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Spring
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {springFrames.map((frame) => (
                <FrameOption
                  key={frame.id}
                  frame={frame}
                  isSelected={selectedFrameId === frame.id}
                  avatarSrc={avatarSrc}
                  initial={initial}
                  onSelect={(id) => handleSelect(id)}
                />
              ))}
            </div>
          </div>

          {/* Neon frames */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Neon
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {neonFrames.map((frame) => (
                <FrameOption
                  key={frame.id}
                  frame={frame}
                  isSelected={selectedFrameId === frame.id}
                  avatarSrc={avatarSrc}
                  initial={initial}
                  onSelect={(id) => handleSelect(id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
