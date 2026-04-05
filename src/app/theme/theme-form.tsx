"use client";

import { useActionState, useState, useEffect, useRef, useCallback } from "react";
import type React from "react";
import { updateTheme } from "./actions";
import { ThemeEditor } from "@/components/theme-editor";
import { BackgroundEditor } from "@/components/background-editor";
import { SparkleEditor } from "@/components/sparkle-editor";
import { FontSelector } from "@/components/font-selector";
import type { BackgroundDefinition } from "@/lib/profile-backgrounds";
import type { CustomPresetData, ProfileThemeColors } from "@/lib/profile-themes";
import type { UserThemeResult } from "@/lib/user-theme";
import { ProfileSparklefall } from "@/components/profile-sparklefall";
import { toast } from "sonner";

interface ThemeFormProps {
  user: {
    username: string | null;
    displayName: string | null;
    bio: string | null;
    usernameFont: string | null;
    profileBgColor: string | null;
    profileTextColor: string | null;
    profileLinkColor: string | null;
    profileSecondaryColor: string | null;
    profileContainerColor: string | null;
    profileContainerOpacity: number | null;
    profileBgImage: string | null;
    profileBgRepeat: string | null;
    profileBgAttachment: string | null;
    profileBgSize: string | null;
    profileBgPosition: string | null;
    sparklefallEnabled: boolean;
    sparklefallPreset: string | null;
    sparklefallSparkles: string | null;
    sparklefallColors: string | null;
    sparklefallInterval: number | null;
    sparklefallWind: number | null;
    sparklefallMaxSparkles: number | null;
    sparklefallMinSize: number | null;
    sparklefallMaxSize: number | null;
  };
  avatarSrc: string | null;
  isPremium: boolean;
  userEmail: string | null;
  backgrounds: BackgroundDefinition[];
  premiumBackgrounds: BackgroundDefinition[];
  customPresets: CustomPresetData[];
  initialTheme: UserThemeResult;
}

interface ThemeState {
  success: boolean;
  message: string;
}

export function ThemeForm({ user, avatarSrc, isPremium, userEmail, backgrounds, premiumBackgrounds, customPresets, initialTheme }: ThemeFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [usernameFont, setUsernameFont] = useState<string | null>(user.usernameFont);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Live theme state for real-time preview
  const [liveThemeStyle, setLiveThemeStyle] = useState<React.CSSProperties | undefined>(initialTheme.themeStyle);
  const [liveBgImageStyle, setLiveBgImageStyle] = useState<React.CSSProperties | undefined>(initialTheme.bgImageStyle);
  const [liveHasCustomTheme, setLiveHasCustomTheme] = useState(initialTheme.hasCustomTheme);
  const [currentBgImage, setCurrentBgImage] = useState<string | null>(user.profileBgImage ?? null);
  const [containerOpacity, setContainerOpacity] = useState(
    Math.min(100, Math.max(80, user.profileContainerOpacity ?? 90))
  );
  const liveContainerOpacityRef = useRef(containerOpacity);

  const [state, formAction, isPending] = useActionState(
    async (prevState: ThemeState, formData: FormData) => {
      return await updateTheme(prevState, formData);
    },
    { success: false, message: "" }
  );

  // Track save status from form action state
  useEffect(() => {
    if (isPending) {
      setSaveStatus("saving");
    } else if (state.message) {
      setSaveStatus(state.success ? "saved" : "error");
      if (state.success) {
        toast.success("Theme saved.");
      } else {
        toast.error(state.message);
      }
      const t = setTimeout(() => setSaveStatus("idle"), 2000);
      return () => clearTimeout(t);
    }
  }, [isPending, state]);

  const handleFormSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    formAction(new FormData(e.currentTarget));
  }, [formAction]);

  const handleSave = useCallback(() => {
    formRef.current?.requestSubmit();
  }, []);

  // Live color update handler
  const handleColorsChange = useCallback((colors: ProfileThemeColors) => {
    const hasTheme = !!(
      colors.profileBgColor ||
      colors.profileTextColor ||
      colors.profileLinkColor ||
      colors.profileSecondaryColor ||
      colors.profileContainerColor
    );
    setLiveHasCustomTheme(hasTheme);
    setLiveThemeStyle(
      hasTheme
        ? {
            "--profile-bg": colors.profileBgColor ?? "#ffffff",
            "--profile-text": colors.profileTextColor ?? "#18181b",
            "--profile-link": colors.profileLinkColor ?? "#2563eb",
            "--profile-secondary": colors.profileSecondaryColor ?? "#71717a",
            "--profile-container": colors.profileContainerColor ?? "#f4f4f5",
            "--profile-container-alpha": `${liveContainerOpacityRef.current}%`,
          } as React.CSSProperties
        : undefined
    );
  }, []);

  const handleContainerOpacityChange = useCallback((opacity: number) => {
    liveContainerOpacityRef.current = opacity;
    setContainerOpacity(opacity);
    setLiveThemeStyle((prev) =>
      prev ? { ...prev, "--profile-container-alpha": `${opacity}%` } as React.CSSProperties : prev
    );
  }, []);

  // Live background update handler
  const handleBackgroundChange = useCallback((bg: {
    image: string | null;
    repeat: string;
    attachment: string;
    size: string;
    position: string;
  }) => {
    setCurrentBgImage(bg.image);
    setLiveBgImageStyle(
      bg.image
        ? {
            backgroundImage: `url(${bg.image})`,
            backgroundRepeat: bg.repeat,
            backgroundAttachment: bg.attachment,
            backgroundSize: bg.size,
            backgroundPosition: bg.position,
            minHeight: "calc(100vh - 57px)",
          }
        : undefined
    );
  }, []);

  return (
    <div
      className={liveHasCustomTheme ? "profile-themed" : ""}
      style={{ ...liveThemeStyle, ...liveBgImageStyle }}
    >
      {initialTheme.sparklefallProps && <ProfileSparklefall {...initialTheme.sparklefallProps} />}
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
        <div className="w-full max-w-2xl space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-rose-600">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Theme & Style
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Customize your appearance
              </p>
            </div>
          </div>

          <form
            ref={formRef}
            onSubmit={handleFormSubmit}
            className="space-y-4"
          >
            <input type="hidden" name="usernameFont" value={usernameFont ?? ""} />

            {/* Save button — top */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isPending ? "Saving..." : "Save"}
            </button>

            <FontSelector
              currentFontId={usernameFont}
              displayName={user.displayName || ""}
              isPremium={isPremium}
              userEmail={userEmail}
              onSelect={(fontId) => { setUsernameFont(fontId); }}
            />

            <ThemeEditor
              initialColors={{
                profileBgColor: user.profileBgColor ?? undefined,
                profileTextColor: user.profileTextColor ?? undefined,
                profileLinkColor: user.profileLinkColor ?? undefined,
                profileSecondaryColor: user.profileSecondaryColor ?? undefined,
                profileContainerColor: user.profileContainerColor ?? undefined,
              }}
              containerOpacity={containerOpacity}
              onContainerOpacityChange={handleContainerOpacityChange}
              username={user.username ?? null}
              displayName={user.displayName}
              bio={user.bio}
              avatarSrc={avatarSrc}
              onSave={handleSave}
              isSavingForm={isPending}
              onColorsChange={handleColorsChange}
              isPremium={isPremium}
              userEmail={userEmail}
              customPresets={customPresets}
              currentBgImage={currentBgImage}
            />

            <BackgroundEditor
              backgrounds={backgrounds}
              premiumBackgrounds={premiumBackgrounds}
              initialBackground={{
                profileBgImage: user.profileBgImage,
                profileBgRepeat: user.profileBgRepeat,
                profileBgAttachment: user.profileBgAttachment,
                profileBgSize: user.profileBgSize,
                profileBgPosition: user.profileBgPosition,
              }}
              isPremium={isPremium}
              userEmail={userEmail}
              containerOpacity={containerOpacity}
              onContainerOpacityChange={handleContainerOpacityChange}
              onBackgroundChange={handleBackgroundChange}
            />

            <SparkleEditor
              initialConfig={{
                sparklefallEnabled: user.sparklefallEnabled,
                sparklefallPreset: user.sparklefallPreset,
                sparklefallSparkles: user.sparklefallSparkles,
                sparklefallColors: user.sparklefallColors,
                sparklefallInterval: user.sparklefallInterval,
                sparklefallWind: user.sparklefallWind,
                sparklefallMaxSparkles: user.sparklefallMaxSparkles,
                sparklefallMinSize: user.sparklefallMinSize,
                sparklefallMaxSize: user.sparklefallMaxSize,
              }}
              isPremium={isPremium}
              userEmail={userEmail}

            />

            {/* Save button */}
            <div className="flex items-center justify-between">
              <p className={`text-sm ${
                saveStatus === "saving" ? "text-zinc-400" :
                saveStatus === "saved" ? "text-green-600" :
                saveStatus === "error" ? "text-red-600" : "text-transparent"
              }`}>
                {saveStatus === "saving" ? "Saving..." :
                 saveStatus === "saved" ? "Saved" :
                 saveStatus === "error" ? state.message :
                 "\u00A0"}
              </p>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
