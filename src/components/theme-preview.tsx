"use client";

import { useEffect } from "react";
import type { ProfileThemeColors } from "@/lib/profile-themes";

interface ThemePreviewProps {
  colors: ProfileThemeColors;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarSrc: string | null;
  onClose: () => void;
}

export function ThemePreview({
  colors,
  username,
  displayName,
  avatarSrc,
  onClose,
}: ThemePreviewProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const name = displayName || username || "Your Name";
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b px-4 py-2"
          style={{
            backgroundColor: colors.profileContainerColor,
            borderColor: colors.profileSecondaryColor + "33",
          }}
        >
          <span
            className="text-sm font-medium"
            style={{ color: colors.profileTextColor }}
          >
            Theme Preview
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm transition-opacity hover:opacity-70"
            style={{ color: colors.profileSecondaryColor }}
          >
            Close
          </button>
        </div>

        {/* Profile mockup */}
        <div
          className="p-6"
          style={{ backgroundColor: colors.profileBgColor }}
        >
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: colors.profileContainerColor }}
          >
            <div className="flex items-start gap-3">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt=""
                  className="h-14 w-14 rounded-full"
                />
              ) : (
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold"
                  style={{
                    backgroundColor: colors.profileSecondaryColor + "33",
                    color: colors.profileTextColor,
                  }}
                >
                  {initial}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h2
                  className="text-lg font-bold"
                  style={{ color: colors.profileTextColor }}
                >
                  {name}
                </h2>
                <p
                  className="text-sm"
                  style={{ color: colors.profileSecondaryColor }}
                >
                  @{username || "username"}
                </p>
              </div>
            </div>

            <p
              className="mt-3 text-sm"
              style={{ color: colors.profileSecondaryColor }}
            >
              This is what your profile bio will look like with these colors.
            </p>

            <div className="mt-3 flex gap-4 text-sm">
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
              <span style={{ color: colors.profileSecondaryColor }}>
                <span
                  className="font-semibold"
                  style={{ color: colors.profileTextColor }}
                >
                  64
                </span>{" "}
                following
              </span>
            </div>
          </div>

          {/* Sample post card */}
          <div
            className="mt-4 rounded-xl p-4"
            style={{ backgroundColor: colors.profileContainerColor }}
          >
            <p
              className="text-sm"
              style={{ color: colors.profileTextColor }}
            >
              Just posted something cool! Check out{" "}
              <span style={{ color: colors.profileLinkColor }}>
                this link
              </span>{" "}
              for more details.
            </p>
            <p
              className="mt-2 text-xs"
              style={{ color: colors.profileSecondaryColor }}
            >
              2 hours ago
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
