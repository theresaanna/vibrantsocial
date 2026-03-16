"use client";

import { getFrameById } from "@/lib/profile-frames";

interface FramedAvatarProps {
  src: string | null | undefined;
  alt?: string;
  initial?: string;
  size: number;
  frameId?: string | null;
  className?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

const FRAME_SCALE = 1.35;

export function FramedAvatar({
  src,
  alt = "",
  initial,
  size,
  frameId,
  className = "",
  referrerPolicy,
}: FramedAvatarProps) {
  const frame = getFrameById(frameId);
  const showFrame = frame && size >= 20;
  const frameSize = size * FRAME_SCALE;
  const frameOffset = (frameSize - size) / 2;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy={referrerPolicy}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full bg-zinc-200 font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
          style={{
            width: size,
            height: size,
            fontSize: size < 20 ? 8 : size < 32 ? 10 : size < 48 ? 14 : 20,
          }}
        >
          {initial || "?"}
        </div>
      )}
      {showFrame && (
        <img
          src={frame.src}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: frameSize,
            height: frameSize,
            top: -frameOffset,
            left: -frameOffset,
          }}
        />
      )}
    </div>
  );
}
