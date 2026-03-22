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

// When a frame is shown, the avatar shrinks to this ratio of the
// container so the frame ring sits outside the photo circle.
const AVATAR_INSET = 0.78;

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
  const showFrame = frame && size >= 24;
  const avatarSize = showFrame ? size * AVATAR_INSET : size;

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
          style={{ width: avatarSize, height: avatarSize }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full bg-zinc-200 font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
          style={{
            width: avatarSize,
            height: avatarSize,
            fontSize: size < 24 ? 8 : size < 40 ? 10 : size < 60 ? 14 : 20,
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
            width: size,
            height: size,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
    </div>
  );
}
