"use client";

import { useEffect, useState } from "react";
import {
  type ProfileThemeColors,
  generateAdaptiveTheme,
  isLightBackground,
} from "@/lib/profile-themes";
import { BioContent } from "@/components/bio-content";

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
  bio,
  avatarSrc,
  onClose,
}: ThemePreviewProps) {
  const { light, dark } = generateAdaptiveTheme(colors);
  const userIsLight = isLightBackground(colors.profileBgColor);
  const [previewMode, setPreviewMode] = useState<"light" | "dark">(
    userIsLight ? "light" : "dark"
  );
  const activeColors = previewMode === "light" ? light : dark;
  const isUserChosen = previewMode === (userIsLight ? "light" : "dark");

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
            backgroundColor: activeColors.profileContainerColor,
            borderColor: activeColors.profileSecondaryColor + "33",
          }}
        >
          <span
            className="text-sm font-medium"
            style={{ color: activeColors.profileTextColor }}
          >
            Theme Preview
          </span>

          {/* Light/Dark toggle */}
          <div className="flex items-center gap-1 rounded-lg p-0.5"
            style={{ backgroundColor: activeColors.profileSecondaryColor + "22" }}
          >
            <button
              type="button"
              onClick={() => setPreviewMode("light")}
              className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                previewMode === "light" ? "opacity-100" : "opacity-50"
              }`}
              style={{
                backgroundColor: previewMode === "light" ? activeColors.profileContainerColor : "transparent",
                color: activeColors.profileTextColor,
              }}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("dark")}
              className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                previewMode === "dark" ? "opacity-100" : "opacity-50"
              }`}
              style={{
                backgroundColor: previewMode === "dark" ? activeColors.profileContainerColor : "transparent",
                color: activeColors.profileTextColor,
              }}
            >
              Dark
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm transition-opacity hover:opacity-70"
            style={{ color: activeColors.profileSecondaryColor }}
          >
            Close
          </button>
        </div>

        {/* Mode indicator */}
        <div
          className="px-4 py-1 text-xs"
          style={{
            backgroundColor: activeColors.profileContainerColor,
            color: activeColors.profileSecondaryColor,
          }}
        >
          {isUserChosen
            ? "Your chosen colors"
            : `Auto-generated for ${previewMode} mode`}
        </div>

        {/* Profile mockup */}
        <div
          className="p-6"
          style={{ backgroundColor: activeColors.profileBgColor }}
        >
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: activeColors.profileContainerColor }}
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
                    backgroundColor: activeColors.profileSecondaryColor + "33",
                    color: activeColors.profileTextColor,
                  }}
                >
                  {initial}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h2
                  className="text-lg font-bold"
                  style={{ color: activeColors.profileTextColor }}
                >
                  {name}
                </h2>
                <p
                  className="text-sm"
                  style={{ color: activeColors.profileSecondaryColor }}
                >
                  @{username || "username"}
                </p>
              </div>
            </div>

            {bio ? (
              <div
                className="mt-3 text-sm"
                style={{ color: activeColors.profileSecondaryColor }}
              >
                <BioContent content={bio} />
              </div>
            ) : (
              <p
                className="mt-3 text-sm"
                style={{ color: activeColors.profileSecondaryColor }}
              >
                This is what your profile bio will look like with these colors.
              </p>
            )}

            <div className="mt-3 flex gap-4 text-sm">
              <span style={{ color: activeColors.profileSecondaryColor }}>
                <span
                  className="font-semibold"
                  style={{ color: activeColors.profileTextColor }}
                >
                  42
                </span>{" "}
                posts
              </span>
              <span style={{ color: activeColors.profileSecondaryColor }}>
                <span
                  className="font-semibold"
                  style={{ color: activeColors.profileTextColor }}
                >
                  128
                </span>{" "}
                followers
              </span>
              <span style={{ color: activeColors.profileSecondaryColor }}>
                <span
                  className="font-semibold"
                  style={{ color: activeColors.profileTextColor }}
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
            style={{ backgroundColor: activeColors.profileContainerColor }}
          >
            <p
              className="text-sm"
              style={{ color: activeColors.profileTextColor }}
            >
              Just posted something cool! Check out{" "}
              <span style={{ color: activeColors.profileLinkColor }}>
                this link
              </span>{" "}
              for more details.
            </p>
            <p
              className="mt-2 text-xs"
              style={{ color: activeColors.profileSecondaryColor }}
            >
              2 hours ago
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
