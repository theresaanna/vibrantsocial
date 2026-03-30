"use client";

import { useActionState, useState, useEffect, useRef, useCallback } from "react";
import { updateTheme } from "./actions";
import { ThemeEditor } from "@/components/theme-editor";
import { BackgroundEditor } from "@/components/background-editor";
import { SparkleEditor } from "@/components/sparkle-editor";
import { FontSelector } from "@/components/font-selector";
import type { BackgroundDefinition } from "@/lib/profile-backgrounds";
import type { CustomPresetData } from "@/lib/profile-themes";
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
  customPresets: CustomPresetData[];
}

interface ThemeState {
  success: boolean;
  message: string;
}

export function ThemeForm({ user, avatarSrc, isPremium, userEmail, backgrounds, customPresets }: ThemeFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedRef = useRef(false);
  const [usernameFont, setUsernameFont] = useState<string | null>(user.usernameFont);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

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

  const scheduleAutosave = useCallback(() => {
    if (!hasMountedRef.current) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 1500);
  }, []);

  // Mark as mounted after first render
  useEffect(() => {
    hasMountedRef.current = true;
    return () => {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
    };
  }, []);

  return (
    <form
      ref={formRef}
      action={formAction}
      onChange={(e) => {
        const target = e.target as HTMLElement;
        if (target instanceof HTMLInputElement && (target.type === "text" || target.type === "email")) return;
        if (target instanceof HTMLTextAreaElement) return;
        scheduleAutosave();
      }}
      className="space-y-4"
    >
      <input type="hidden" name="usernameFont" value={usernameFont ?? ""} />

      <FontSelector
        currentFontId={usernameFont}
        displayName={user.displayName || ""}
        isPremium={isPremium}
        userEmail={userEmail}
        onSelect={(fontId) => { setUsernameFont(fontId); scheduleAutosave(); }}
      />

      <ThemeEditor
        initialColors={{
          profileBgColor: user.profileBgColor ?? undefined,
          profileTextColor: user.profileTextColor ?? undefined,
          profileLinkColor: user.profileLinkColor ?? undefined,
          profileSecondaryColor: user.profileSecondaryColor ?? undefined,
          profileContainerColor: user.profileContainerColor ?? undefined,
        }}
        username={user.username ?? null}
        displayName={user.displayName}
        bio={user.bio}
        avatarSrc={avatarSrc}
        onChange={scheduleAutosave}
        isPremium={isPremium}
        userEmail={userEmail}
        customPresets={customPresets}
      />

      <BackgroundEditor
        backgrounds={backgrounds}
        initialBackground={{
          profileBgImage: user.profileBgImage,
          profileBgRepeat: user.profileBgRepeat,
          profileBgAttachment: user.profileBgAttachment,
          profileBgSize: user.profileBgSize,
          profileBgPosition: user.profileBgPosition,
        }}
        isPremium={isPremium}
        userEmail={userEmail}
        onChange={scheduleAutosave}
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
        onChange={scheduleAutosave}
      />

      {saveStatus === "saving" && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Saving...</p>
      )}
    </form>
  );
}
