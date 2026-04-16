"use client";

import { useActionState, useState, useEffect, useRef, useCallback, useTransition, useId } from "react";
import type React from "react";
import { updateTheme } from "./actions";
import { generateTheme } from "./generate-theme-action";
import { ThemeEditor } from "@/components/theme-editor";
import { BackgroundEditor } from "@/components/background-editor";
import { SparkleEditor } from "@/components/sparkle-editor";
import { FontSelector } from "@/components/font-selector";
import type { BackgroundDefinition } from "@/lib/profile-backgrounds";
import { isFreePresetBackground } from "@/lib/profile-backgrounds";
import type { CustomPresetData, ProfileThemeColors } from "@/lib/profile-themes";
import type { UserThemeResult } from "@/lib/user-theme";
import { ProfileSparklefall } from "@/components/profile-sparklefall";
import { toast } from "sonner";
import { type ThemeExport, validateThemeExport } from "@/lib/theme-export";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";

/** Check if a URL is hosted on Vercel Blob storage by parsing its hostname. */
function isVercelBlobUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "blob.vercel-storage.com" || hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

interface ThemeFormProps {
  user: {
    username: string | null;
    displayName: string | null;
    bio: string | null;
    usernameFont: string | null;
    profileFrameId: string | null;
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
  const [themeOpen, setThemeOpen] = useState(false);
  const themeSectionId = useId();

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

  // Auto AI theme generation when a background is selected
  const [autoGenColors, setAutoGenColors] = useState<ProfileThemeColors | null>(null);
  const [autoGenTheme, setAutoGenTheme] = useState<{
    name: string;
    light: ProfileThemeColors;
    dark: ProfileThemeColors;
  } | null>(null);
  const [isAutoGenerating, startAutoGenTransition] = useTransition();
  const autoGenDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Theme export/import
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importedBackground, setImportedBackground] = useState<{
    image: string | null;
    repeat: string;
    attachment: string;
    size: string;
    position: string;
  } | null>(null);

  const handleExportTheme = useCallback(async () => {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);

    const bgImageUrl = (formData.get("profileBgImage") as string) || null;

    // Fetch background image bytes for custom uploads
    let imageBytes: Uint8Array | undefined;
    let imageFilename: string | undefined;
    if (bgImageUrl && isVercelBlobUrl(bgImageUrl)) {
      try {
        const res = await fetch(bgImageUrl);
        const contentType = res.headers.get("content-type") ?? "image/png";
        const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg"
          : contentType.includes("gif") ? "gif"
          : contentType.includes("webp") ? "webp"
          : "png";
        imageFilename = `background.${ext}`;
        const buf = await res.arrayBuffer();
        imageBytes = new Uint8Array(buf);
      } catch {
        toast.error("Could not embed background image");
      }
    }

    const themeExport: ThemeExport = {
      version: 1,
      colors: {
        profileBgColor: (formData.get("profileBgColor") as string) || "#ffffff",
        profileTextColor: (formData.get("profileTextColor") as string) || "#18181b",
        profileLinkColor: (formData.get("profileLinkColor") as string) || "#2563eb",
        profileSecondaryColor: (formData.get("profileSecondaryColor") as string) || "#71717a",
        profileContainerColor: (formData.get("profileContainerColor") as string) || "#f4f4f5",
      },
      containerOpacity,
      background: {
        imageUrl: bgImageUrl,
        ...(imageFilename ? { imageFile: imageFilename } : {}),
        repeat: (formData.get("profileBgRepeat") as string) || "no-repeat",
        attachment: (formData.get("profileBgAttachment") as string) || "scroll",
        size: (formData.get("profileBgSize") as string) || "100% 100%",
        position: (formData.get("profileBgPosition") as string) || "center",
      },
    };

    const jsonBytes = strToU8(JSON.stringify(themeExport, null, 2));

    const zipFiles: Record<string, Uint8Array> = { "theme.json": jsonBytes };
    if (imageBytes && imageFilename) {
      zipFiles[imageFilename] = imageBytes;
    }

    const zipped = zipSync(zipFiles);
    const blob = new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vibrantsocial-theme.zip";
    a.click();
    URL.revokeObjectURL(url);
  }, [containerOpacity]);

  const applyImportedTheme = useCallback(
    async (validated: ThemeExport, imageBlob: Blob | null) => {
      // Apply colors
      setAutoGenColors(validated.colors);
      handleContainerOpacityChange(validated.containerOpacity);

      let resolvedBgUrl = validated.background.imageUrl;

      // Upload bundled image file from zip
      if (imageBlob) {
        try {
          const uploadForm = new FormData();
          uploadForm.append(
            "file",
            imageBlob,
            validated.background.imageFile ?? "imported-background.png"
          );
          const uploadRes = await fetch("/api/profile-background", {
            method: "POST",
            body: uploadForm,
          });
          if (uploadRes.ok) {
            const { url } = await uploadRes.json();
            resolvedBgUrl = url;
          } else {
            toast("Could not upload background image. Colors applied.", { duration: 5000 });
            resolvedBgUrl = null;
          }
        } catch {
          toast("Could not upload background image. Colors applied.", { duration: 5000 });
          resolvedBgUrl = null;
        }
      } else if (validated.background.imageData) {
        // Legacy JSON-only format with base64 imageData
        try {
          const res = await fetch(validated.background.imageData);
          const blob = await res.blob();
          const uploadForm = new FormData();
          uploadForm.append("file", blob, "imported-background.png");
          const uploadRes = await fetch("/api/profile-background", {
            method: "POST",
            body: uploadForm,
          });
          if (uploadRes.ok) {
            const { url } = await uploadRes.json();
            resolvedBgUrl = url;
          } else {
            toast("Could not upload background image. Colors applied.", { duration: 5000 });
            resolvedBgUrl = null;
          }
        } catch {
          toast("Could not upload background image. Colors applied.", { duration: 5000 });
          resolvedBgUrl = null;
        }
      } else if (resolvedBgUrl && isVercelBlobUrl(resolvedBgUrl)) {
        toast("Background image can't be imported without embedded data. Colors applied.", { duration: 5000 });
        resolvedBgUrl = null;
      }

      setImportedBackground({
        image: resolvedBgUrl,
        repeat: validated.background.repeat,
        attachment: validated.background.attachment,
        size: validated.background.size,
        position: validated.background.position,
      });

      toast.success("Theme imported — click Save to apply");
    },
    [handleContainerOpacityChange]
  );

  const handleImportTheme = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuf = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuf);

        // Detect zip (PK header) vs plain JSON
        const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;

        if (isZip) {
          const unzipped = unzipSync(bytes);

          // Find theme.json
          const jsonEntry = unzipped["theme.json"];
          if (!jsonEntry) {
            toast.error("Invalid theme zip: missing theme.json");
            return;
          }

          const parsed = JSON.parse(strFromU8(jsonEntry));
          const validated = validateThemeExport(parsed);
          if (!validated) {
            toast.error("Invalid theme file");
            return;
          }

          // Find bundled background image
          let imageBlob: Blob | null = null;
          if (validated.background.imageFile && unzipped[validated.background.imageFile]) {
            const imgBytes = unzipped[validated.background.imageFile];
            const ext = validated.background.imageFile.split(".").pop()?.toLowerCase();
            const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
              : ext === "png" ? "image/png"
              : ext === "gif" ? "image/gif"
              : ext === "webp" ? "image/webp"
              : ext === "svg" ? "image/svg+xml"
              : "image/png";
            imageBlob = new Blob([imgBytes.buffer as ArrayBuffer], { type: mimeType });
          }

          await applyImportedTheme(validated, imageBlob);
        } else {
          // Legacy JSON-only format
          const text = new TextDecoder().decode(bytes);
          const parsed = JSON.parse(text);
          const validated = validateThemeExport(parsed);
          if (!validated) {
            toast.error("Invalid theme file");
            return;
          }
          await applyImportedTheme(validated, null);
        }
      } catch {
        toast.error("Could not read theme file");
      }
    };
    reader.readAsArrayBuffer(file);
    if (importInputRef.current) importInputRef.current.value = "";
  }, [applyImportedTheme]);

  const handleBackgroundSelected = useCallback((imageUrl: string | null) => {
    if (!imageUrl) return;
    // Allow generation for premium users or free users with a free preset background
    if (!isPremium && !isFreePresetBackground(imageUrl)) return;
    // Debounce rapid background browsing
    if (autoGenDebounce.current) clearTimeout(autoGenDebounce.current);
    autoGenDebounce.current = setTimeout(() => {
      startAutoGenTransition(async () => {
        const result = await generateTheme(imageUrl);
        if (result.success && result.light) {
          setAutoGenColors(result.light);
          if (result.name && result.dark) {
            setAutoGenTheme({
              name: result.name,
              light: result.light,
              dark: result.dark,
            });
          }
          toast.success("Colors generated from background — save as preset?");
        }
      });
    }, 600);
  }, [isPremium]);

  return (
    <div
      className={liveHasCustomTheme ? "profile-themed" : ""}
      style={{ ...liveThemeStyle, ...liveBgImageStyle }}
    >
      {initialTheme.sparklefallProps && (
        <ProfileSparklefall {...initialTheme.sparklefallProps} rewardOnClick={false} />
      )}
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
        <div className="w-full max-w-2xl space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "var(--profile-link, #d946ef)" }}>
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

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setThemeOpen((o) => !o)}
                aria-expanded={themeOpen}
                aria-controls={themeSectionId}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Theme & Background
                </h2>
                <svg
                  className={`h-5 w-5 text-zinc-400 transition-transform ${themeOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div id={themeSectionId} className={`space-y-6 px-4 pb-4 ${themeOpen ? "" : "hidden"}`}>
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
                    frameId={user.profileFrameId}
                    fontId={usernameFont}
                    onColorsChange={handleColorsChange}
                    isPremium={isPremium}
                    userEmail={userEmail}
                    customPresets={customPresets}
                    currentBgImage={currentBgImage}
                    externalColors={autoGenColors}
                    externalGeneratedTheme={autoGenTheme}
                    embedded
                  />

                  {isAutoGenerating && (
                    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-950">
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                      <span className="text-sm text-blue-700 dark:text-blue-300">
                        Generating colors from background...
                      </span>
                    </div>
                  )}

                  <hr className="border-zinc-200 dark:border-zinc-700" />

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
                    onBackgroundSelected={handleBackgroundSelected}
                    externalBackground={importedBackground}
                    embedded
                  />

                  <hr className="border-zinc-200 dark:border-zinc-700" />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportTheme}
                      className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Download Theme
                    </button>
                    <button
                      type="button"
                      onClick={() => importInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                      Upload Theme
                    </button>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".zip,.json"
                      onChange={handleImportTheme}
                      className="hidden"
                    />
                  </div>
                </div>
            </div>

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
